"""Governance platform — policy management and approvals."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


POLICY_TYPES = {
    "tenant",
    "ai_usage",
    "workflow",
    "provider",
    "data_retention",
}


class GovernanceService:
    """Manages versioned policies and approval workflows."""

    def create_policy_payload(
        self,
        name: str,
        policy_type: str,
        rules: Dict[str, Any],
        *,
        version: int = 1,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if policy_type not in POLICY_TYPES:
            raise ValueError(f"Unsupported policy_type: {policy_type}")
        return {
            "name": name,
            "policy_type": policy_type,
            "version": version,
            "status": "draft",
            "rules": rules,
            "approval_status": "pending",
            "approved_by": None,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    def approve(self, policy: Dict[str, Any], *, actor: str) -> Dict[str, Any]:
        return {
            **policy,
            "status": "active",
            "approval_status": "approved",
            "approved_by": actor,
            "approved_at": datetime.now(timezone.utc).isoformat(),
        }

    def bump_version(self, policy: Dict[str, Any], rules: Dict[str, Any]) -> Dict[str, Any]:
        return {
            **policy,
            "version": int(policy.get("version", 1)) + 1,
            "rules": rules,
            "status": "draft",
            "approval_status": "pending",
            "approved_by": None,
        }

    def evaluate_ai_usage(self, policy_rules: Dict[str, Any], usage: Dict[str, Any]) -> Dict[str, Any]:
        max_tokens = policy_rules.get("max_tokens_per_day", 1_000_000)
        allowed_models = set(policy_rules.get("allowed_models", []))
        tokens = int(usage.get("tokens", 0))
        model = usage.get("model")
        violations: List[str] = []
        if tokens > max_tokens:
            violations.append("max_tokens_per_day")
        if allowed_models and model not in allowed_models:
            violations.append("model_not_allowed")
        return {
            "allowed": not violations,
            "violations": violations,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }
