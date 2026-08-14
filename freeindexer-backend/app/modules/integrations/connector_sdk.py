"""Pluggable Connector SDK.

Defines the contract every connector implements. Connectors are versioned,
declare capabilities and a JSON configuration schema, and expose lifecycle
hooks. New connectors require no core architecture changes — they subclass
``BaseConnector`` and register with the ``ConnectorRegistry``.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ConnectorContext:
    """Runtime context passed to a connector."""

    tenant_id: str
    integration_id: str
    config: Dict[str, Any] = field(default_factory=dict)
    credentials: Dict[str, str] = field(default_factory=dict)  # decrypted secrets


@dataclass
class SyncResult:
    """Result of a synchronize() call."""

    records_processed: int = 0
    records_failed: int = 0
    checkpoint: Dict[str, Any] = field(default_factory=dict)
    conflicts: List[Dict[str, Any]] = field(default_factory=list)
    detail: Dict[str, Any] = field(default_factory=dict)


@dataclass
class HealthStatus:
    status: str = "unknown"  # healthy|degraded|warning|error|unknown
    score: int = 0  # 0-100
    latency_ms: int = 0
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)


class BaseConnector(abc.ABC):
    """Abstract connector contract."""

    #: Unique connector type identifier, e.g. "google_search_console".
    connector_type: str = "base"
    #: Semantic version of the connector implementation.
    version: str = "1.0.0"
    #: Capabilities this connector supports (e.g. ["sync", "webhooks"]).
    capabilities: List[str] = []
    #: JSON schema describing accepted configuration.
    config_schema: Dict[str, Any] = {}

    def __init__(self, context: ConnectorContext) -> None:
        self.context = context

    # -- lifecycle ---------------------------------------------------------
    @abc.abstractmethod
    async def authenticate(self) -> bool:
        """Authenticate with the external service. Return True on success."""

    @abc.abstractmethod
    async def validate(self) -> bool:
        """Validate configuration and credentials. Return True if valid."""

    @abc.abstractmethod
    async def synchronize(
        self, mode: str = "incremental", checkpoint: Optional[Dict[str, Any]] = None
    ) -> SyncResult:
        """Run a synchronization. ``mode`` is incremental|full."""

    async def publish_event(self, event_type: str, payload: Dict[str, Any]) -> bool:
        """Publish an event to the external service. Optional."""
        return True

    async def receive_event(self, event_type: str, payload: Dict[str, Any]) -> bool:
        """Handle an inbound event from the external service. Optional."""
        return True

    @abc.abstractmethod
    async def health_check(self) -> HealthStatus:
        """Return the connector's current health."""

    # -- metadata ----------------------------------------------------------
    def is_compatible(self, platform_version: str) -> bool:
        """Compatibility check against the platform version. Default: compatible."""
        return True

    def describe(self) -> Dict[str, Any]:
        return {
            "connector_type": self.connector_type,
            "version": self.version,
            "capabilities": list(self.capabilities),
            "config_schema": self.config_schema,
        }
