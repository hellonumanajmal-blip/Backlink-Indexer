"""Connector registry and manager.

The registry maps connector type -> connector class. The manager instantiates
connectors with a runtime context. Registering a new connector type requires
no core changes.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Type

from app.modules.integrations.connector_sdk import BaseConnector, ConnectorContext
from app.modules.integrations.connectors import BUILTIN_CONNECTORS


class ConnectorRegistry:
    """Registry of available connector types."""

    def __init__(self) -> None:
        self._registry: Dict[str, Type[BaseConnector]] = {}

    def register(self, connector_cls: Type[BaseConnector]) -> None:
        self._registry[connector_cls.connector_type] = connector_cls

    def get(self, connector_type: str) -> Optional[Type[BaseConnector]]:
        return self._registry.get(connector_type)

    def is_supported(self, connector_type: str) -> bool:
        return connector_type in self._registry

    def list_types(self) -> List[str]:
        return sorted(self._registry.keys())

    def describe_all(self) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for ct in self.list_types():
            cls = self._registry[ct]
            out.append(
                {
                    "connector_type": cls.connector_type,
                    "version": cls.version,
                    "capabilities": list(cls.capabilities),
                    "config_schema": cls.config_schema,
                    "supported": True,
                }
            )
        return out


class ConnectorManager:
    """Instantiates connectors bound to a runtime context."""

    def __init__(self, registry: ConnectorRegistry) -> None:
        self.registry = registry

    def create(
        self,
        connector_type: str,
        *,
        tenant_id: str,
        integration_id: str,
        config: Optional[Dict[str, Any]] = None,
        credentials: Optional[Dict[str, str]] = None,
    ) -> BaseConnector:
        cls = self.registry.get(connector_type)
        if cls is None:
            raise ValueError(f"Unsupported connector type: {connector_type}")
        ctx = ConnectorContext(
            tenant_id=tenant_id,
            integration_id=integration_id,
            config=config or {},
            credentials=credentials or {},
        )
        return cls(ctx)


_registry: Optional[ConnectorRegistry] = None


def get_registry() -> ConnectorRegistry:
    global _registry
    if _registry is None:
        _registry = ConnectorRegistry()
        for cls in BUILTIN_CONNECTORS:
            _registry.register(cls)
    return _registry


def get_manager() -> ConnectorManager:
    return ConnectorManager(get_registry())
