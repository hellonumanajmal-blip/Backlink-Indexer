"""Planning utilities for AI workflows."""
from __future__ import annotations

from typing import Any, Dict, List


class Planner:
    """Produces deterministic execution plans for agents."""

    async def create_plan(self, goal: str, context: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
        return [{"goal": goal, "context": context or {}, "type": "sequential"}]
