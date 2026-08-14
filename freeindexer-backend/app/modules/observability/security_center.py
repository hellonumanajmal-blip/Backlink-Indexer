"""Security Center — API security monitoring and threat signals."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.observability import metrics


class SecurityCenter:
    """Detects failed logins, token abuse, rate-limit issues, and IP reputation signals."""

    def __init__(self) -> None:
        self._failed_logins: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self._token_hits: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self._ip_reputation: Dict[str, Dict[str, Any]] = defaultdict(dict)
        self._secret_rotations: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    def record_failed_login(
        self,
        tenant_id: str,
        *,
        actor: str,
        ip_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        self._failed_logins[tenant_id][actor] += 1
        count = self._failed_logins[tenant_id][actor]
        suspicious = count >= 5
        if ip_address:
            self._ip_reputation[tenant_id][ip_address] = {
                "score": max(0.0, 1.0 - (count * 0.1)),
                "failed_logins": count,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        event = {
            "event_type": "failed_login",
            "severity": "high" if suspicious else "warning",
            "actor": actor,
            "ip_address": ip_address,
            "resource": "auth",
            "details": {"failure_count": count, "suspicious": suspicious},
            "status": "open",
        }
        metrics.observability_security_events_total.labels(
            tenant_id=tenant_id, event_type="failed_login", severity=event["severity"]
        ).inc()
        return event

    def record_token_abuse(
        self,
        tenant_id: str,
        *,
        actor: str,
        token_fingerprint: str,
        reason: str = "excessive_use",
    ) -> Dict[str, Any]:
        self._token_hits[tenant_id][token_fingerprint] += 1
        hits = self._token_hits[tenant_id][token_fingerprint]
        event = {
            "event_type": "token_abuse",
            "severity": "critical" if hits >= 20 else "high",
            "actor": actor,
            "ip_address": None,
            "resource": f"token:{token_fingerprint[:8]}",
            "details": {"hits": hits, "reason": reason},
            "status": "open",
        }
        metrics.observability_security_events_total.labels(
            tenant_id=tenant_id, event_type="token_abuse", severity=event["severity"]
        ).inc()
        return event

    def record_rate_limit(
        self,
        tenant_id: str,
        *,
        actor: Optional[str],
        ip_address: Optional[str],
        endpoint: str,
    ) -> Dict[str, Any]:
        event = {
            "event_type": "rate_limit",
            "severity": "warning",
            "actor": actor,
            "ip_address": ip_address,
            "resource": endpoint,
            "details": {"monitor": "rate_limit"},
            "status": "open",
        }
        metrics.observability_security_events_total.labels(
            tenant_id=tenant_id, event_type="rate_limit", severity="warning"
        ).inc()
        return event

    def validate_webhook(
        self,
        tenant_id: str,
        *,
        signature_valid: bool,
        source: str,
    ) -> Dict[str, Any]:
        event = {
            "event_type": "webhook_validation",
            "severity": "info" if signature_valid else "high",
            "actor": source,
            "ip_address": None,
            "resource": "webhook",
            "details": {"signature_valid": signature_valid},
            "status": "closed" if signature_valid else "open",
        }
        metrics.observability_security_events_total.labels(
            tenant_id=tenant_id,
            event_type="webhook_validation",
            severity=event["severity"],
        ).inc()
        return event

    def track_secret_rotation(
        self,
        tenant_id: str,
        *,
        secret_name: str,
        actor: str,
    ) -> Dict[str, Any]:
        record = {
            "secret_name": secret_name,
            "actor": actor,
            "rotated_at": datetime.now(timezone.utc).isoformat(),
        }
        self._secret_rotations[tenant_id].append(record)
        event = {
            "event_type": "secret_rotation",
            "severity": "info",
            "actor": actor,
            "ip_address": None,
            "resource": secret_name,
            "details": record,
            "status": "closed",
        }
        metrics.observability_security_events_total.labels(
            tenant_id=tenant_id, event_type="secret_rotation", severity="info"
        ).inc()
        return event

    def detect_suspicious_activity(
        self,
        tenant_id: str,
        *,
        signals: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        signals = signals or {}
        score = 0.0
        reasons: List[str] = []
        if signals.get("failed_logins", 0) >= 5:
            score += 0.4
            reasons.append("repeated_failed_logins")
        if signals.get("token_hits", 0) >= 20:
            score += 0.4
            reasons.append("token_abuse")
        if signals.get("geo_anomaly"):
            score += 0.2
            reasons.append("geo_anomaly")
        event = {
            "event_type": "suspicious_activity",
            "severity": "critical" if score >= 0.7 else ("high" if score >= 0.4 else "info"),
            "actor": signals.get("actor"),
            "ip_address": signals.get("ip_address"),
            "resource": "security_center",
            "details": {"score": score, "reasons": reasons, "signals": signals},
            "status": "open" if score >= 0.4 else "closed",
        }
        metrics.observability_security_events_total.labels(
            tenant_id=tenant_id, event_type="suspicious_activity", severity=event["severity"]
        ).inc()
        return event

    def ip_reputation(self, tenant_id: str, ip_address: str) -> Dict[str, Any]:
        return self._ip_reputation.get(tenant_id, {}).get(
            ip_address,
            {"score": 1.0, "failed_logins": 0, "updated_at": None},
        )
