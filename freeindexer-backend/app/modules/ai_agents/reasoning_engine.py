"""Reasoning engine abstraction for agentic workflows."""
from __future__ import annotations

from typing import Any, Dict


class ReasoningEngine:
    """Centralizes multi-step reasoning and short/long context decisions."""

    async def reason(self, context: Dict[str, Any]) -> Dict[str, Any]:
        return {"decision": "continue", "context": context}
