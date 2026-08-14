"""Permission policy helpers for tool execution."""
from __future__ import annotations

from typing import Dict, Set


TOOL_PERMISSIONS: Dict[str, Set[str]] = {
    "search": {"integrations:read"},
    "http": {"integrations:read"},
    "webhook": {"integrations:webhooks"},
    "sql": {"integrations:admin"},
    "python": {"integrations:admin"},
}


def permission_for_tool(tool: str) -> Set[str]:
    return TOOL_PERMISSIONS.get(tool, {"integrations:read"})
