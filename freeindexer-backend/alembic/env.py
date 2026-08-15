"""Alembic environment configuration."""
from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.models.base import Base

# Import all models so metadata is populated for autogenerate.
from app.modules.ai_agents import models as ai_agents_models  # noqa: F401
from app.modules.ai_platform import models as ai_platform_models  # noqa: F401
from app.modules.auth import models as auth_models  # noqa: F401
from app.modules.indexing import models as indexing_models  # noqa: F401
from app.modules.integrations import models as integration_models  # noqa: F401
from app.modules.knowledge_platform import models as knowledge_platform_models  # noqa: F401
from app.modules.observability import models as observability_models  # noqa: F401

def _sync_database_url(url: str) -> str:
    """Alembic needs a sync driver; the app keeps using asyncpg/aiosqlite."""
    if "+asyncpg" in url:
        return url.replace("+asyncpg", "+psycopg2", 1)
    if "+aiosqlite" in url:
        return url.replace("+aiosqlite", "", 1)
    return url


config = context.config
config.set_main_option("sqlalchemy.url", _sync_database_url(settings.database_url))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
