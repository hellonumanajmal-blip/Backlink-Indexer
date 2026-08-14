"""Conversation lifecycle manager for the AI Agent Platform."""
from __future__ import annotations

from typing import Any, Dict, List


class ConversationManager:
    """Coordinates session and conversation state for agents."""

    async def create(self, session_id: str, agent_id: str) -> Dict[str, Any]:
        return {"session_id": session_id, "agent_id": agent_id, "history": []}

    async def append(self, session_id: str, message: Dict[str, Any]) -> Dict[str, Any]:
        return {"session_id": session_id, "message": message}
