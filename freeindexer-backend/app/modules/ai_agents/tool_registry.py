"""Tool registry for AI agent tools and enterprise service adapters."""
from __future__ import annotations

from typing import Any, Dict, List


class ToolRegistry:
    """Registry of pluggable tools for search, HTTP, SQL, Python, filesystem, email, and REST."""

    def __init__(self) -> None:
        self.tools: Dict[str, Dict[str, Any]] = {
            "search": {"category": "search", "enabled": True},
            "http": {"category": "http", "enabled": True},
            "webhook": {"category": "webhook", "enabled": True},
            "sql": {"category": "sql", "enabled": True},
            "python": {"category": "python", "enabled": True},
            "filesystem": {"category": "filesystem", "enabled": True},
            "email": {"category": "email", "enabled": True},
            "rest": {"category": "rest", "enabled": True},
        }

    def list_tools(self) -> List[Dict[str, Any]]:
        return [
            {"name": name, **details}
            for name, details in self.tools.items()
        ]
