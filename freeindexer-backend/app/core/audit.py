"""Audit logging.

Structured, append-only audit records for security-relevant actions. Records
are written via structlog and can be persisted by the integrations module's
activity log. Secrets are always masked before logging.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

import structlog

logger = structlog.get_logger("audit")


def mask_secret(value: Optional[str], visible: int = 4) -> Optional[str]:
    """Mask a secret, leaving only the last ``visible`` characters."""
    if value is None:
        return None
    if len(value) <= visible:
        return "*" * len(value)
    return "*" * (len(value) - visible) + value[-visible:]


def audit_log(
    action: str,
    *,
    tenant_id: str,
    actor: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    outcome: str = "success",
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Emit a structured audit record and return it for persistence."""
    record: Dict[str, Any] = {
        "action": action,
        "tenant_id": tenant_id,
        "actor": actor,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "outcome": outcome,
        "metadata": metadata or {},
    }
    logger.info("audit", **record)
    return record
