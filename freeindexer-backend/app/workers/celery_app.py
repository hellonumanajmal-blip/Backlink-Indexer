"""Central Celery app for the FreeIndexer backend.

Fork lifecycle
--------------
The async engine in ``app.database.session`` is created once at import time,
in the Celery master process. Under the prefork (ForkPoolWorker) pool every
child process inherits that engine's connection pool, whose asyncpg
connections belong to the parent's event loop and to socket file descriptors
shared with the parent. Reusing them in a child raises
``asyncpg.exceptions.InterfaceError: cannot perform operation: another
operation is in progress``.

``reset_db_state_after_fork`` (connected to ``worker_process_init``, which
Celery dispatches once per forked child before it consumes any task) fixes
both halves of the problem:

1. It discards the inherited pool via ``Engine.dispose(close=False)`` --
   the connections are de-referenced, never closed, so the parent's sockets
   are left untouched -- and the child gets a fresh, empty pool.
2. It creates one dedicated event loop for the child. Tasks must not call
   ``asyncio.run()`` per task: each call creates and closes a new loop while
   the shared pool retains connections created on previous, now-closed
   loops, which asyncpg cannot reuse. ``run_async`` drives every task in the
   process on the single loop created here, so pooled connections stay
   bound to one live loop for the lifetime of the child.
"""
from __future__ import annotations

import asyncio
from typing import Any, Coroutine

from celery import Celery
from celery.signals import worker_process_init, worker_process_shutdown

from app.core.config import settings
from app.database.session import dispose_engine_after_fork

celery_app = Celery(
    "freeindexer",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_queue="default",
    task_routes={
        "indexing_engine.process_job": {"queue": "discovery"},
        "indexing_engine.process_retries": {"queue": "retry"},
        "indexing_engine.validate_url": {"queue": "url_validation"},
        "indexing_engine.verify_backlink": {"queue": "backlink_verification"},
        "indexing_engine.monitor_crawl": {"queue": "crawl_monitoring"},
        "indexing_engine.verify_index": {"queue": "index_verification"},
    },
    beat_schedule={
        "indexing-engine-retries": {
            "task": "indexing_engine.process_retries",
            "schedule": 300.0,
        },
    },
)

#: Event loop dedicated to this worker process. Created per forked child in
#: ``reset_db_state_after_fork``; ``None`` outside a real Celery worker
#: process (tests, eager mode, shell), where ``run_async`` falls back to
#: ``asyncio.run``.
_worker_loop: asyncio.AbstractEventLoop | None = None


@worker_process_init.connect()
def reset_db_state_after_fork(**kwargs: Any) -> None:
    """Dispose the inherited engine pool and give the child its own loop.

    Runs synchronously in each prefork child immediately after the fork,
    before the child executes any task.
    """
    global _worker_loop

    # Discard pool state inherited from the parent without closing the
    # parent-shared connections (see dispose_engine_after_fork).
    dispose_engine_after_fork()

    # Fresh loop for this process; defensive close in case the signal fires
    # twice in one process (it can in tests).
    if _worker_loop is not None:
        _worker_loop.close()
    _worker_loop = asyncio.new_event_loop()


@worker_process_shutdown.connect()
def close_worker_loop(**kwargs: Any) -> None:
    """Close the worker's event loop when the child process shuts down."""
    global _worker_loop
    if _worker_loop is not None:
        _worker_loop.close()
        _worker_loop = None


def run_async(coro: Coroutine[Any, Any, Any]) -> Any:
    """Run a coroutine on the worker process's dedicated event loop.

    Inside a Celery worker process this drives the coroutine on the single
    loop created by ``reset_db_state_after_fork`` so pooled asyncpg
    connections always run on the loop they were created on. Outside a
    worker it falls back to ``asyncio.run``, preserving the previous
    behavior for eager mode and tests.
    """
    if _worker_loop is None:
        return asyncio.run(coro)
    return _worker_loop.run_until_complete(coro)


# Import tasks modules to register tasks on the shared app.
# These imports are intentionally side-effectful and must remain in this file,
# below run_async so the modules can import it during this module's own import.
from app.modules.knowledge_platform import tasks  # noqa: F401,E402
from app.modules.observability import tasks as observability_tasks  # noqa: F401,E402
from app.modules.indexing.engine import tasks as indexing_engine_tasks  # noqa: F401,E402
