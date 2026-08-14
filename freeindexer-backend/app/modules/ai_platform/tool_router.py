"""Tool-specific router helpers for the AI platform."""
from __future__ import annotations

from typing import Any, Dict


class ToolRouter:
    """Provides a registry-oriented tool routing façade."""

    def route(self, tool: str) -> Dict[str, Any]:
        return {"tool": tool, "route": "internal"}
