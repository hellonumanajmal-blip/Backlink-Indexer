"""Shared pytest fixtures for the integrations module tests."""
from __future__ import annotations

import os
from typing import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Force a development environment + in-memory DB before app imports settings.
os.environ.setdefault("FI_ENVIRONMENT", "development")
os.environ.setdefault("FI_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FI_SECRET_KEY", "test-secret-key-0123456789abcdef")
os.environ["FI_MAX_DISCOVERY_MODE"] = "false"

from app.auth import create_access_token  # noqa: E402
from app.database import get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.modules.ai_agents import models as ai_models  # noqa: F401,E402
from app.modules.ai_platform import models as ai_platform_models  # noqa: F401,E402
from app.modules.indexing import models as indexing_models  # noqa: F401,E402
from app.modules.indexing.engine import models as indexing_engine_models  # noqa: F401,E402
from app.modules.knowledge_platform import models as knowledge_platform_models  # noqa: F401,E402
from app.modules.observability import models as observability_models  # noqa: F401,E402
from app.modules.integrations import models  # noqa: F401,E402


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def engine():
    eng = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest.fixture
async def session(engine) -> AsyncGenerator[AsyncSession, None]:
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        yield s


@pytest.fixture
async def client(engine) -> AsyncGenerator[AsyncClient, None]:
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with factory() as s:
            try:
                yield s
                await s.commit()
            except Exception:
                await s.rollback()
                raise

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def tenant_id() -> str:
    return "tenant-1"


@pytest.fixture
def auth_headers(tenant_id) -> dict:
    token = create_access_token("user-1", tenant_id, roles=["admin"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_tenant_headers() -> dict:
    token = create_access_token("user-2", "tenant-2", roles=["admin"])
    return {"Authorization": f"Bearer {token}"}
