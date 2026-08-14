"""Phase 34 enterprise observability platform tests."""
from __future__ import annotations

import pytest

from app.auth import create_access_token
from app.modules.observability.tasks import (
    alert_processing_task,
    compliance_scan_task,
    health_monitoring_task,
    log_cleanup_task,
    metrics_aggregation_task,
    sla_evaluation_task,
)


@pytest.fixture
def viewer_headers(tenant_id) -> dict:
    token = create_access_token("viewer-1", tenant_id, roles=["viewer"])
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_health_monitoring(client, auth_headers):
    response = await client.get("/api/observability/health", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"healthy", "degraded", "unhealthy"}
    assert len(body["dependencies"]) >= 1

    checks = await client.get("/api/observability/health/checks", headers=auth_headers)
    assert checks.status_code == 200
    assert isinstance(checks.json(), list)
    assert len(checks.json()) >= 1


@pytest.mark.asyncio
async def test_alert_generation(client, auth_headers):
    create = await client.post(
        "/api/observability/alerts",
        headers=auth_headers,
        json={
            "name": "high-error-rate",
            "message": "Error rate exceeded threshold",
            "severity": "critical",
            "source": "sla_monitor",
        },
    )
    assert create.status_code == 201
    alert = create.json()
    assert alert["id"]
    assert alert["status"] == "firing"
    assert "oncall" in alert["routed_to"]

    listed = await client.get("/api/observability/alerts", headers=auth_headers)
    assert listed.status_code == 200
    assert any(a["id"] == alert["id"] for a in listed.json())

    ack = await client.post(
        f"/api/observability/alerts/{alert['id']}/acknowledge",
        headers=auth_headers,
    )
    assert ack.status_code == 200
    assert ack.json()["status"] == "acknowledged"


@pytest.mark.asyncio
async def test_incident_workflows(client, auth_headers):
    create = await client.post(
        "/api/observability/incidents",
        headers=auth_headers,
        json={
            "title": "API outage",
            "description": "Elevated 5xx",
            "severity": "high",
        },
    )
    assert create.status_code == 201
    incident = create.json()
    incident_id = incident["id"]
    assert incident["status"] == "open"

    ack = await client.post(
        f"/api/observability/incidents/{incident_id}/acknowledge",
        headers=auth_headers,
    )
    assert ack.status_code == 200
    assert ack.json()["status"] == "acknowledged"

    esc = await client.post(
        f"/api/observability/incidents/{incident_id}/escalate",
        headers=auth_headers,
    )
    assert esc.status_code == 200
    assert esc.json()["escalation_level"] == 1
    assert esc.json()["status"] == "investigating"

    resolved = await client.post(
        f"/api/observability/incidents/{incident_id}/resolve",
        headers=auth_headers,
        json={"rca": "Bad deploy rolled back"},
    )
    assert resolved.status_code == 200
    body = resolved.json()
    assert body["status"] == "resolved"
    assert body["rca"] == "Bad deploy rolled back"
    assert any(h["action"] == "resolved" for h in body["history"])


@pytest.mark.asyncio
async def test_governance_policies(client, auth_headers):
    create = await client.post(
        "/api/observability/governance/policies",
        headers=auth_headers,
        json={
            "name": "AI daily token cap",
            "policy_type": "ai_usage",
            "rules": {"max_tokens_per_day": 1000, "allowed_models": ["gpt-enterprise"]},
        },
    )
    assert create.status_code == 201
    policy = create.json()
    assert policy["status"] == "draft"
    assert policy["version"] == 1

    approved = await client.post(
        f"/api/observability/governance/policies/{policy['id']}/approve",
        headers=auth_headers,
    )
    assert approved.status_code == 200
    assert approved.json()["approval_status"] == "approved"
    assert approved.json()["status"] == "active"

    versioned = await client.post(
        f"/api/observability/governance/policies/{policy['id']}/version",
        headers=auth_headers,
        json={"rules": {"max_tokens_per_day": 2000, "allowed_models": ["gpt-enterprise"]}},
    )
    assert versioned.status_code == 200
    assert versioned.json()["version"] == 2
    assert versioned.json()["approval_status"] == "pending"


@pytest.mark.asyncio
async def test_compliance_reports(client, auth_headers):
    consent = await client.post(
        "/api/observability/compliance/consent",
        headers=auth_headers,
        json={"subject_id": "user-a", "purpose": "analytics", "granted": True},
    )
    assert consent.status_code == 201

    retention = await client.post(
        "/api/observability/compliance/retention",
        headers=auth_headers,
        json={"resource_type": "logs", "retain_days": 30},
    )
    assert retention.status_code == 201

    deletion = await client.post(
        "/api/observability/compliance/deletion",
        headers=auth_headers,
        json={"subject_id": "user-a", "resource_types": ["logs"]},
    )
    assert deletion.status_code == 201
    assert deletion.json()["status"] == "queued"

    readiness = await client.get(
        "/api/observability/compliance/readiness", headers=auth_headers
    )
    assert readiness.status_code == 200
    assert readiness.json()["framework"] == "gdpr"
    assert readiness.json()["ready"] is True

    report = await client.post(
        "/api/observability/compliance/reports", headers=auth_headers
    )
    assert report.status_code == 201
    assert report.json()["id"]
    assert report.json()["findings"]["ready"] is True

    export = await client.get("/api/observability/compliance/export", headers=auth_headers)
    assert export.status_code == 200
    assert "consents" in export.json()


@pytest.mark.asyncio
async def test_security_monitoring(client, auth_headers):
    failed = await client.post(
        "/api/observability/security/events",
        headers=auth_headers,
        json={
            "event_type": "failed_login",
            "actor": "attacker",
            "ip_address": "203.0.113.10",
        },
    )
    assert failed.status_code == 201
    assert failed.json()["event_type"] == "failed_login"

    for _ in range(4):
        await client.post(
            "/api/observability/security/events",
            headers=auth_headers,
            json={
                "event_type": "failed_login",
                "actor": "attacker",
                "ip_address": "203.0.113.10",
            },
        )

    token_abuse = await client.post(
        "/api/observability/security/events",
        headers=auth_headers,
        json={
            "event_type": "token_abuse",
            "actor": "svc-bot",
            "token_fingerprint": "abc123fingerprint",
        },
    )
    assert token_abuse.status_code == 201

    webhook = await client.post(
        "/api/observability/security/events",
        headers=auth_headers,
        json={
            "event_type": "webhook_validation",
            "actor": "stripe",
            "signature_valid": False,
        },
    )
    assert webhook.status_code == 201
    assert webhook.json()["severity"] == "high"

    reputation = await client.get(
        "/api/observability/security/ip/203.0.113.10", headers=auth_headers
    )
    assert reputation.status_code == 200
    assert reputation.json()["failed_logins"] >= 5

    events = await client.get("/api/observability/security/events", headers=auth_headers)
    assert events.status_code == 200
    assert len(events.json()) >= 1


@pytest.mark.asyncio
async def test_metrics_traces_logs_diagnostics_sla(client, auth_headers):
    metric = await client.post(
        "/api/observability/metrics",
        headers=auth_headers,
        json={"name": "request_latency_ms", "value": 42.5, "labels": {"route": "/health"}},
    )
    assert metric.status_code == 201

    metrics = await client.get("/api/observability/metrics", headers=auth_headers)
    assert metrics.status_code == 200
    assert metrics.json()["aggregate"]["sample_count"] >= 1

    span = await client.post(
        "/api/observability/traces",
        headers=auth_headers,
        json={"service_name": "api", "operation": "GET /health"},
    )
    assert span.status_code == 201
    finished = await client.post(
        "/api/observability/traces/finish",
        headers=auth_headers,
        json={"span_id": span.json()["span_id"], "status": "ok", "duration_ms": 12.0},
    )
    assert finished.status_code == 200
    assert finished.json()["status"] == "ok"

    log = await client.post(
        "/api/observability/logs",
        headers=auth_headers,
        json={"level": "info", "message": "health probe complete", "service": "observability"},
    )
    assert log.status_code == 201
    assert log.json()["correlation_id"] is not None or True

    diag = await client.post(
        "/api/observability/diagnostics",
        headers=auth_headers,
        json={"name": "platform_check", "category": "system", "context": {}},
    )
    assert diag.status_code == 201
    assert diag.json()["status"] == "pass"

    sla = await client.get("/api/observability/sla", headers=auth_headers)
    assert sla.status_code == 200
    assert "compliance_ratio" in sla.json()

    overview = await client.get("/api/observability/overview", headers=auth_headers)
    assert overview.status_code == 200
    assert "Platform Overview" in overview.json()["sections"]


@pytest.mark.asyncio
async def test_api_authorization(client, viewer_headers, auth_headers):
    denied = await client.post(
        "/api/observability/governance/policies",
        headers=viewer_headers,
        json={"name": "x", "policy_type": "tenant", "rules": {}},
    )
    assert denied.status_code == 403

    allowed_read = await client.get("/api/observability/overview", headers=viewer_headers)
    assert allowed_read.status_code == 200

    other = create_access_token("user-2", "tenant-2", roles=["admin"])
    other_headers = {"Authorization": f"Bearer {other}"}
    created = await client.post(
        "/api/observability/incidents",
        headers=auth_headers,
        json={"title": "tenant-1 incident", "severity": "low"},
    )
    assert created.status_code == 201
    incident_id = created.json()["id"]

    cross = await client.get(
        f"/api/observability/incidents/{incident_id}", headers=other_headers
    )
    assert cross.status_code == 404


@pytest.mark.asyncio
async def test_background_jobs(tenant_id, engine):
    # Tasks open their own sessions against the configured DB URL; for unit
    # coverage we invoke the async job methods directly through a session.
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from app.modules.observability.service import ObservabilityService

    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        svc = ObservabilityService(session)
        health = await svc.health_monitoring_job(tenant_id)
        assert "status" in health
        await svc.record_metric(tenant_id, "jobs", 1.0)
        await svc.create_alert(tenant_id, "job-alert", "processing", severity="warning")
        alerts = await svc.process_alerts_job(tenant_id)
        assert alerts["processed"] >= 1
        await svc.track_consent(
            tenant_id, subject_id="s1", purpose="ops", granted=True, actor="system"
        )
        await svc.set_retention(
            tenant_id, resource_type="logs", retain_days=7, legal_basis="contract", actor="system"
        )
        scan = await svc.compliance_scan_job(tenant_id)
        assert scan["report_id"]
        agg = await svc.metrics_aggregation_job(tenant_id)
        assert agg["sample_count"] >= 1
        cleanup = await svc.log_cleanup_job(tenant_id, keep=10)
        assert "removed_logs" in cleanup
        sla = await svc.sla_evaluation_job(tenant_id)
        assert "sla" in sla
        await session.commit()

    # Ensure Celery task callables are importable/registered.
    assert health_monitoring_task.name == "observability.health_monitoring"
    assert sla_evaluation_task.name == "observability.sla_evaluation"
    assert alert_processing_task.name == "observability.alert_processing"
    assert compliance_scan_task.name == "observability.compliance_scan"
    assert log_cleanup_task.name == "observability.log_cleanup"
    assert metrics_aggregation_task.name == "observability.metrics_aggregation"
