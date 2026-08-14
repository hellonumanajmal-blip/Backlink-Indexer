"""Unit tests for the connector SDK and registry."""
from __future__ import annotations

import pytest

from app.modules.integrations.connector_registry import ConnectorManager, get_registry
from app.modules.integrations.connector_sdk import ConnectorContext
from app.modules.integrations.connectors import (
    BUILTIN_CONNECTORS,
    GenericRESTConnector,
    GoogleSearchConsoleConnector,
    SlackConnector,
)


def test_registry_has_all_builtin_connectors() -> None:
    registry = get_registry()
    types = registry.list_types()
    for expected in [
        "google_search_console",
        "bing_webmaster_tools",
        "slack",
        "microsoft_teams",
        "discord",
        "smtp_email",
        "generic_rest",
        "generic_webhook",
    ]:
        assert expected in types


def test_registry_describe_all() -> None:
    registry = get_registry()
    described = registry.describe_all()
    assert len(described) == len(BUILTIN_CONNECTORS)
    for item in described:
        assert item["supported"] is True
        assert "capabilities" in item
        assert "config_schema" in item


def test_manager_creates_connector() -> None:
    manager = ConnectorManager(get_registry())
    connector = manager.create(
        "slack", tenant_id="t1", integration_id="i1", config={}, credentials={}
    )
    assert isinstance(connector, SlackConnector)
    assert connector.context.tenant_id == "t1"


def test_manager_rejects_unknown_type() -> None:
    manager = ConnectorManager(get_registry())
    with pytest.raises(ValueError):
        manager.create("does_not_exist", tenant_id="t1", integration_id="i1")


@pytest.mark.asyncio
async def test_connector_lifecycle_without_credentials() -> None:
    ctx = ConnectorContext(tenant_id="t1", integration_id="i1", config={}, credentials={})
    connector = GoogleSearchConsoleConnector(ctx)
    assert await connector.authenticate() is False
    assert await connector.validate() is True
    health = await connector.health_check()
    assert health.status == "degraded"
    result = await connector.synchronize(mode="incremental")
    assert result.records_processed == 0


@pytest.mark.asyncio
async def test_connector_lifecycle_with_credentials() -> None:
    ctx = ConnectorContext(
        tenant_id="t1", integration_id="i1", config={}, credentials={"api_key": "abc"}
    )
    connector = GenericRESTConnector(ctx)
    assert await connector.authenticate() is True
    health = await connector.health_check()
    assert health.status == "healthy"
    assert health.score == 100


def test_connector_describe_and_compatibility() -> None:
    ctx = ConnectorContext(tenant_id="t1", integration_id="i1")
    connector = SlackConnector(ctx)
    described = connector.describe()
    assert described["connector_type"] == "slack"
    assert connector.is_compatible("1.0.0") is True
