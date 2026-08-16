"""Regression tests for the Celery prefork async-database lifecycle.

Production failure guarded by this module:

    asyncpg.exceptions.InterfaceError: cannot perform operation: another
    operation is in progress

Root cause (two defects, both fixed in ``app.workers.celery_app`` /
``app.database.session``):

1. ``app.database.session.engine`` is created once at import time in the
   Celery master process. Every ForkPool child inherits that engine's
   connection pool: its asyncpg connections are bound to the parent's event
   loop and to socket file descriptors shared with the parent. The first
   child task to check one out trips asyncpg's per-connection operation
   guard (``asyncpg.connection._Atomic``) and raises ``InterfaceError``.
   Fix: the ``worker_process_init`` handler calls
   ``Engine.dispose(close=False)`` -- SQLAlchemy's documented post-fork API
   -- which swaps in a fresh, empty pool while leaving the parent-shared
   connections untouched.

2. Tasks used ``asyncio.run()`` per task. Each call creates and closes a
   new event loop, but the shared pool keeps connections created on
   previous, now-closed loops, which asyncpg cannot reuse. Fix: the
   ``worker_process_init`` handler creates one dedicated event loop per
   child and every task runs on it via ``run_async``.

Test strategy -- every test below FAILS if the fork handler is removed:

* ``test_worker_process_init_handler_is_registered`` -- resolves the real
  signal's live receivers and asserts our handler is among them.
* ``test_worker_process_init_replaces_inherited_pool`` -- dispatches the
  real ``worker_process_init`` signal with a spy on the real sync engine
  and asserts ``dispose(close=False)`` was called and the pool object was
  replaced. No conditionals: the call list must be exactly
  ``[{"close": False}]``.
* ``test_dispose_engine_after_fork_contract`` -- fake engine pins the
  ``close=False`` contract with no database at all.
* ``test_process_retries_task_survives_forked_engine_lifecycle`` -- full
  end-to-end simulation of a forked child: "parent" uses the engine on a
  loop that is then closed, the real signal fires, and the real Celery
  task ``indexing_engine.process_retries`` (the exact task scheduled by
  Celery Beat as ``indexing-engine-retries``) runs to completion.

Note on the test database: tests run against
``sqlite+aiosqlite:///:memory:`` (see ``tests/conftest.py``), for which
SQLAlchemy selects ``StaticPool`` -- a single connection reused for every
checkout. Replacing that pool discards the connection and, because SQLite's
``:memory:`` database lives and dies with the connection, the schema must
be recreated afterwards. In production Postgres the schema lives on the
server and survives pool replacement, so schema recreation here is purely
to keep the SQLite substrate usable and changes nothing being verified.
"""
from __future__ import annotations

import ast
import asyncio
import inspect
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from celery.signals import worker_process_init, worker_process_shutdown
from sqlalchemy import text

import app.workers.celery_app as celery_worker
from app.database import session as db_session
from app.database.session import (
    AsyncSessionLocal,
    dispose_engine_after_fork,
    engine,
)
from app.models.base import Base
from app.modules.indexing.engine import tasks as indexing_tasks
from app.modules.indexing.engine.models import IndexingJob
from app.modules.indexing.engine.states import PipelineStatus
from app.modules.knowledge_platform import tasks as knowledge_tasks
from app.modules.observability import tasks as observability_tasks
from app.workers.celery_app import run_async

TENANT = "tenant-fork-regression"

REGISTERED_TASK_MODULES = (
    indexing_tasks,
    knowledge_tasks,
    observability_tasks,
)


async def _create_schema() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def _fire_worker_process_init():
    """Dispatch the real signal exactly as a forked Celery child does.

    Celery's ``Signal.send`` is robust-style: receiver exceptions come back
    in the responses instead of propagating, so every response is asserted
    to be a real return value, never an exception.
    """
    responses = worker_process_init.send(sender=None)
    assert responses, "worker_process_init dispatch must reach our receiver"
    for receiver, response in responses:
        assert not isinstance(response, Exception), (
            f"worker_process_init receiver {receiver!r} raised {response!r}"
        )
    return responses


@pytest.fixture(autouse=True)
def _isolate_worker_process_state():
    """Start every test from clean worker state and leave it clean behind us.

    Resets the per-worker loop, then after the test closes the loop via the
    real shutdown signal and discards any pooled connection bound to the
    test's event loops, so this module cannot leak state into other tests.
    """
    celery_worker._worker_loop = None
    yield
    worker_process_shutdown.send(sender=None)
    dispose_engine_after_fork()


def test_worker_process_init_handler_is_registered():
    """The fork handler must be connected to the real Celery signal.

    Resolves the signal's live receivers (weak references included) the
    same way ``Signal.send`` does, so this fails if the handler is deleted,
    renamed, or never connected.
    """
    live_receivers = worker_process_init._live_receivers(None)
    assert celery_worker.reset_db_state_after_fork in live_receivers, (
        "app.workers.celery_app.reset_db_state_after_fork must be connected "
        "to celery.signals.worker_process_init"
    )


@pytest.mark.anyio
async def test_worker_process_init_replaces_inherited_pool(monkeypatch):
    """The real signal must replace the inherited pool via dispose(close=False).

    Simulates the parent process using the engine (leaving a live pooled
    connection), fires the real signal, and asserts:
      1. ``Engine.dispose`` was called exactly once with ``close=False``
         (never ``close=True``: closing inherited asyncpg connections would
         write to sockets shared with the parent process).
      2. The engine's pool object was actually replaced with a fresh one.
      3. A session on the shared engine still executes queries afterwards.
    """
    # "Parent" phase: use the engine so the pool holds a live connection.
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT 1"))
        await session.commit()

    sync_engine = engine.sync_engine
    inherited_pool = sync_engine.pool
    dispose_calls: list[dict] = []
    original_dispose = sync_engine.dispose

    def spy_dispose(**kwargs):
        dispose_calls.append(kwargs)
        return original_dispose(**kwargs)

    monkeypatch.setattr(sync_engine, "dispose", spy_dispose)

    _fire_worker_process_init()

    assert dispose_calls == [{"close": False}], (
        "worker_process_init must reset the inherited pool by calling "
        "Engine.dispose(close=False) exactly once"
    )
    assert sync_engine.pool is not inherited_pool, (
        "worker_process_init must replace the pool inherited via fork"
    )

    # SQLite :memory: artifact only: the discarded StaticPool connection
    # owned the in-memory database, so recreate the schema (see module
    # docstring). Postgres schema survives pool replacement.
    await _create_schema()
    async with AsyncSessionLocal() as session:
        assert (await session.execute(text("SELECT 1"))).scalar_one() == 1


def test_dispose_engine_after_fork_contract(monkeypatch):
    """dispose_engine_after_fork passes close=False -- never close=True.

    Uses a fake engine so the contract is pinned without any database:
    after a fork the inherited connections must be de-referenced without
    being closed, because their sockets are shared with the parent.
    """
    calls: list[dict] = []
    fake_sync_engine = SimpleNamespace(
        pool=SimpleNamespace(),
        dispose=lambda **kwargs: calls.append(kwargs),
    )
    fake_engine = SimpleNamespace(sync_engine=fake_sync_engine)
    monkeypatch.setattr(db_session, "engine", fake_engine)

    dispose_engine_after_fork()

    assert calls == [{"close": False}], (
        "dispose_engine_after_fork must call engine.sync_engine.dispose"
        "(close=False): closing fork-inherited asyncpg connections would "
        "corrupt sockets still used by the parent process"
    )


def test_run_async_uses_the_dedicated_worker_loop():
    """After the fork signal, run_async executes on the child's own loop."""
    _fire_worker_process_init()

    loop = celery_worker._worker_loop
    assert loop is not None, "fork handler must create a worker event loop"
    assert not loop.is_closed()
    assert not loop.is_running()

    async def _current_loop():
        return asyncio.get_running_loop()

    assert run_async(_current_loop()) is loop


def test_run_async_falls_back_to_asyncio_run_outside_a_worker():
    """Without worker init (eager mode, tests) run_async behaves as before."""

    async def _current_loop():
        return asyncio.get_running_loop()

    assert celery_worker._worker_loop is None
    used_loop = run_async(_current_loop())
    assert used_loop.is_closed(), "fallback must be asyncio.run, which closes its loop"


def test_process_retries_task_survives_forked_engine_lifecycle():
    """End-to-end: the Beat-scheduled retry task runs after a simulated fork.

    Sequence (mirrors production ForkPoolWorker):
      1. "Parent" uses the shared engine on an event loop that then closes
         (worst case of the real parent, whose loop the child must never
         touch).
      2. ``worker_process_init`` fires in the "child" -- pool discarded,
         dedicated loop created.
      3. The real task ``indexing_engine.process_retries`` (queue ``retry``,
         scheduled by Beat as ``indexing-engine-retries``) is invoked
         synchronously, exactly as the worker would, and must complete
         without InterfaceError or event-loop errors.

    The seeded job hits the scheduler's deterministic "wait" action (see
    ``app.modules.indexing.engine.scheduler``), so no network I/O occurs.
    """
    # --- parent phase: engine used on a loop that then closes ---
    parent_loop = asyncio.new_event_loop()
    parent_loop.run_until_complete(_create_schema())
    parent_loop.run_until_complete(_seed_due_retry_job())
    parent_loop.close()

    # --- child phase: the signal every forked Celery child receives ---
    _fire_worker_process_init()

    # SQLite :memory: artifact only (see module docstring): the discarded
    # StaticPool connection owned the in-memory database. In production the
    # Postgres schema lives on the server and survives pool replacement.
    run_async(_create_schema())
    run_async(_seed_due_retry_job())

    # --- the actual Celery task, invoked synchronously as the worker does ---
    result = indexing_tasks.process_retries(limit=10)

    assert result["processed"] == 1
    assert len(result["ids"]) == 1


async def _seed_due_retry_job() -> None:
    """Create one retry-due job on the shared engine (current loop)."""
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        session.add(
            IndexingJob(
                tenant_id=TENANT,
                source_url="https://fork-regression.example/a",
                source_url_hash="fork-regression-hash",
                pipeline_status=PipelineStatus.RETRY_PENDING.value,
                next_retry_at=now - timedelta(minutes=1),
                experiment_started_at=now - timedelta(hours=1),
                priority_score=50,
                priority_band="MEDIUM",
                public_listed=False,
                channel_snapshot={},
                submitted_at=now - timedelta(hours=1),
            )
        )
        await session.commit()


def test_registered_task_modules_never_create_a_session_at_import_time():
    """No Celery task module may hold a module-level AsyncSession.

    A session created at import time in the master would be shared by every
    forked child and every task. Scans the module-level statements (task
    function bodies excluded -- per-task ``async with AsyncSessionLocal()``
    inside a task is exactly the intended pattern) of every task module the
    Celery app registers.
    """

    def _calls_async_session_local(node: ast.AST) -> bool:
        return (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "AsyncSessionLocal"
        )

    for module in REGISTERED_TASK_MODULES:
        tree = ast.parse(inspect.getsource(module))
        offenders = []
        for stmt in tree.body:
            if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                continue
            offenders.extend(n for n in ast.walk(stmt) if _calls_async_session_local(n))
        assert not offenders, (
            f"{module.__name__} creates AsyncSessionLocal() at module level; "
            "sessions must be created inside each task body"
        )
