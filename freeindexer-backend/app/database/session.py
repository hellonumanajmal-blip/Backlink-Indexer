"""Async database session management.

Provides the SQLAlchemy async engine, session factory, and a FastAPI
dependency that yields scoped sessions. Uses SQLite (aiosqlite) by default so
the module and its tests run without external services; swap ``database_url``
for Postgres in production.
"""
from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=settings.db_echo, future=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def dispose_engine_after_fork() -> None:
    """Reset the engine's connection pool after ``os.fork()``.

    ``engine`` is created at import time, so a Celery prefork child inherits
    the parent's pool. The inherited asyncpg connections are bound to the
    parent's event loop and to socket file descriptors shared with the parent;
    using (or closing) them inside the child corrupts protocol state and
    raises ``asyncpg.exceptions.InterfaceError``.

    ``Engine.dispose(close=False)`` is SQLAlchemy's documented post-fork
    pattern (added in 1.4.33): it replaces the inherited pool with a fresh,
    empty one *without* touching the old connections, so the parent keeps
    sole ownership of its sockets and event listeners are carried over. The
    child's next checkout opens a new connection bound to the child's own
    event loop.

    Synchronous by design: it must be callable from Celery's synchronous
    ``worker_process_init`` signal, before any child event loop exists.
    """
    engine.sync_engine.dispose(close=False)
