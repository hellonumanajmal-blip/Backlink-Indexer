# Connector SDK

The Connector SDK lets you add new external integrations without changing core
architecture. A connector is a Python class that subclasses `BaseConnector` and
registers with the `ConnectorRegistry`.

## Contract

```python
from app.modules.integrations.connector_sdk import (
    BaseConnector, ConnectorContext, SyncResult, HealthStatus,
)

class MyConnector(BaseConnector):
    connector_type = "my_service"        # unique identifier
    version = "1.0.0"                    # semantic version
    capabilities = ["sync", "webhooks"]  # declared capabilities
    config_schema = {                    # JSON schema for configuration
        "type": "object",
        "properties": {"api_base": {"type": "string"}},
        "required": ["api_base"],
    }

    async def authenticate(self) -> bool: ...
    async def validate(self) -> bool: ...
    async def synchronize(self, mode="incremental", checkpoint=None) -> SyncResult: ...
    async def health_check(self) -> HealthStatus: ...
    # optional:
    async def publish_event(self, event_type, payload) -> bool: ...
    async def receive_event(self, event_type, payload) -> bool: ...
```

## Lifecycle methods

| Method | Required | Purpose |
|--------|----------|---------|
| `authenticate()` | yes | Establish authenticated session |
| `validate()` | yes | Validate config + credentials |
| `synchronize()` | yes | Pull/push data; return `SyncResult` |
| `health_check()` | yes | Return `HealthStatus` |
| `publish_event()` | no | Push an event to the service |
| `receive_event()` | no | Handle an inbound event |

## Context

Each connector receives a `ConnectorContext`:

- `tenant_id`, `integration_id` — scoping
- `config` — validated configuration dict
- `credentials` — decrypted secrets keyed by credential kind

## Versioning & compatibility

- `version` follows semver.
- `is_compatible(platform_version)` can be overridden to gate a connector on a
  platform version. Default returns `True`.
- `describe()` returns metadata used by the `/connectors/types` endpoint.

## Registering

```python
from app.modules.integrations.connector_registry import get_registry

get_registry().register(MyConnector)
```

Registration is the only step required — the connector becomes available to the
API, sync engine, webhook platform, and health monitor automatically.

## Built-in connectors

`google_search_console`, `bing_webmaster_tools`, `slack`, `microsoft_teams`,
`discord`, `smtp_email`, `generic_rest`, `generic_webhook`.
