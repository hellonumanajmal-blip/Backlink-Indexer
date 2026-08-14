"""MCP server registry and discovery helper."""
from __future__ import annotations

from typing import Any, Dict, List


class MCPRegistry:
    """Registry for MCP servers that can participate in agent execution."""

    def __init__(self) -> None:
        self._servers: Dict[str, List[Dict[str, Any]]] = {}

    def list_servers(self, tenant_id: str) -> List[Dict[str, Any]]:
        self._servers.setdefault(tenant_id, [{"name": "local-mcp", "transport": "stdio", "enabled": True}])
        return list(self._servers[tenant_id])
