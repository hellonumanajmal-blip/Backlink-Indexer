"""MCP client facade for local and remote MCP connections."""
from __future__ import annotations

from typing import Any, Dict, List


class MCPClient:
    """Lightweight MCP client adapter for transport-agnostic orchestration."""

    async def connect(self, endpoint: str, transport: str = "http") -> Dict[str, Any]:
        return {"endpoint": endpoint, "transport": transport, "status": "connected"}

    async def list_tools(self) -> List[Dict[str, Any]]:
        return [{"name": "mcp_search", "enabled": True}]
