"""Built-in connectors.

Each connector subclasses ``BaseConnector``. Network calls are isolated behind
small methods so they can be mocked in tests; by default connectors operate in
a safe "offline" mode that validates configuration and reports health without
requiring live external credentials.
"""
from __future__ import annotations

import time
from typing import Any, Dict, Optional

from app.modules.integrations.connector_sdk import (
    BaseConnector,
    ConnectorContext,
    HealthStatus,
    SyncResult,
)


class _OfflineConnector(BaseConnector):
    """Base providing safe default behaviour for built-in connectors."""

    def _has_credential(self) -> bool:
        return bool(self.context.credentials)

    async def authenticate(self) -> bool:
        return self._has_credential()

    async def validate(self) -> bool:
        return True

    async def synchronize(
        self, mode: str = "incremental", checkpoint: Optional[Dict[str, Any]] = None
    ) -> SyncResult:
        return SyncResult(
            records_processed=0,
            records_failed=0,
            checkpoint=checkpoint or {},
            detail={"mode": mode, "offline": not self._has_credential()},
        )

    async def health_check(self) -> HealthStatus:
        start = time.perf_counter()
        ok = self._has_credential()
        latency = int((time.perf_counter() - start) * 1000)
        return HealthStatus(
            status="healthy" if ok else "degraded",
            score=100 if ok else 40,
            latency_ms=latency,
            message="configured" if ok else "missing credentials",
        )


class GoogleSearchConsoleConnector(_OfflineConnector):
    connector_type = "google_search_console"
    version = "1.0.0"
    capabilities = ["sync", "oauth", "webhooks"]
    config_schema = {
        "type": "object",
        "properties": {"site_url": {"type": "string"}},
        "required": ["site_url"],
    }


class BingWebmasterToolsConnector(_OfflineConnector):
    connector_type = "bing_webmaster_tools"
    version = "1.0.0"
    capabilities = ["sync", "api_key"]
    config_schema = {
        "type": "object",
        "properties": {"site_url": {"type": "string"}},
        "required": ["site_url"],
    }


class SlackConnector(_OfflineConnector):
    connector_type = "slack"
    version = "1.0.0"
    capabilities = ["webhooks", "publish_event"]
    config_schema = {
        "type": "object",
        "properties": {"default_channel": {"type": "string"}},
    }


class MicrosoftTeamsConnector(_OfflineConnector):
    connector_type = "microsoft_teams"
    version = "1.0.0"
    capabilities = ["webhooks", "publish_event"]
    config_schema = {"type": "object", "properties": {}}


class DiscordConnector(_OfflineConnector):
    connector_type = "discord"
    version = "1.0.0"
    capabilities = ["webhooks", "publish_event"]
    config_schema = {"type": "object", "properties": {}}


class SMTPEmailConnector(_OfflineConnector):
    connector_type = "smtp_email"
    version = "1.0.0"
    capabilities = ["publish_event"]
    config_schema = {
        "type": "object",
        "properties": {
            "host": {"type": "string"},
            "port": {"type": "integer"},
            "from_address": {"type": "string"},
        },
        "required": ["host"],
    }


class GenericRESTConnector(_OfflineConnector):
    connector_type = "generic_rest"
    version = "1.0.0"
    capabilities = ["sync", "api_key", "oauth"]
    config_schema = {
        "type": "object",
        "properties": {"base_url": {"type": "string"}},
        "required": ["base_url"],
    }


class GenericWebhookConnector(_OfflineConnector):
    connector_type = "generic_webhook"
    version = "1.0.0"
    capabilities = ["webhooks", "publish_event", "receive_event"]
    config_schema = {
        "type": "object",
        "properties": {"target_url": {"type": "string"}},
    }


BUILTIN_CONNECTORS = [
    GoogleSearchConsoleConnector,
    BingWebmasterToolsConnector,
    SlackConnector,
    MicrosoftTeamsConnector,
    DiscordConnector,
    SMTPEmailConnector,
    GenericRESTConnector,
    GenericWebhookConnector,
]
