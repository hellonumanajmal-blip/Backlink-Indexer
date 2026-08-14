"""Incident management workflows."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


SEVERITIES = ("critical", "high", "medium", "low")


class IncidentManager:
    """Creates incidents, handles ack/escalation/resolution and RCA history."""

    def create_payload(
        self,
        title: str,
        *,
        description: str = "",
        severity: str = "medium",
        metadata: Optional[Dict[str, Any]] = None,
        actor: str = "system",
    ) -> Dict[str, Any]:
        if severity not in SEVERITIES:
            raise ValueError(f"Invalid severity: {severity}")
        now = datetime.now(timezone.utc).isoformat()
        return {
            "title": title,
            "description": description,
            "severity": severity,
            "status": "open",
            "acknowledged_by": None,
            "acknowledged_at": None,
            "resolved_by": None,
            "resolved_at": None,
            "escalation_level": 0,
            "rca": None,
            "history": [{"action": "created", "actor": actor, "at": now}],
            "metadata": metadata or {},
        }

    def acknowledge(self, incident: Dict[str, Any], *, actor: str) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        history: List[Dict[str, Any]] = list(incident.get("history") or [])
        history.append({"action": "acknowledged", "actor": actor, "at": now})
        return {
            **incident,
            "status": "acknowledged",
            "acknowledged_by": actor,
            "acknowledged_at": now,
            "history": history,
        }

    def escalate(self, incident: Dict[str, Any], *, actor: str) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        level = int(incident.get("escalation_level") or 0) + 1
        history: List[Dict[str, Any]] = list(incident.get("history") or [])
        history.append({"action": "escalated", "actor": actor, "level": level, "at": now})
        return {
            **incident,
            "status": "investigating",
            "escalation_level": level,
            "history": history,
        }

    def resolve(
        self,
        incident: Dict[str, Any],
        *,
        actor: str,
        rca: Optional[str] = None,
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        history: List[Dict[str, Any]] = list(incident.get("history") or [])
        history.append({"action": "resolved", "actor": actor, "at": now, "rca": rca})
        return {
            **incident,
            "status": "resolved",
            "resolved_by": actor,
            "resolved_at": now,
            "rca": rca,
            "history": history,
        }
