"""Service-layer tests: lifecycle, credentials, sync, webhooks, health, isolation."""
from __future__ import annotations

import time

import pytest

from app.modules.integrations.service import IntegrationService
from app.modules.integrations.webhook_platform import compute_signature


async def _make_integration(svc: IntegrationService, tenant: str) -> str:
    integration = await svc.create_integration(
        tenant, "tester", name="GSC", connector_type="google_search_console",
        config={"site_url": "https://example.com"},
    )
    return integration.id


@pytest.mark.asyncio
async def test_integration_lifecycle(session) -> None:
    svc = IntegrationService(session)
    iid = await _make_integration(svc, "tenant-1")

    fetched = await svc.get_integration("tenant-1", iid)
    assert fetched is not None and fetched.name == "GSC"

    updated = await svc.update_integration("tenant-1", "tester", iid, enabled=False)
    assert updated is not None and updated.status == "disabled"

    listed = await svc.list_integrations("tenant-1")
    assert len(listed) == 1

    deleted = await svc.delete_integration("tenant-1", "tester", iid)
    assert deleted is True
    assert await svc.get_integration("tenant-1", iid) is None


@pytest.mark.asyncio
async def test_unsupported_connector_type_rejected(session) -> None:
    svc = IntegrationService(session)
    with pytest.raises(ValueError):
        await svc.create_integration(
            "tenant-1", "tester", name="Bad", connector_type="nope", config={}
        )


@pytest.mark.asyncio
async def test_credential_encryption_and_masking(session) -> None:
    svc = IntegrationService(session)
    iid = await _make_integration(svc, "tenant-1")
    cred = await svc.store_credential(
        "tenant-1", "tester", integration_id=iid, kind="api_key", secret="sk-secret-123456"
    )
    assert cred.secret_encrypted != "sk-secret-123456"
    assert "secret" not in (cred.masked_hint or "")
    # Decrypts back to original via vault
    assert svc.vault.decrypt(cred.secret_encrypted) == "sk-secret-123456"


@pytest.mark.asyncio
async def test_credential_rotation(session) -> None:
    svc = IntegrationService(session)
    iid = await _make_integration(svc, "tenant-1")
    cred = await svc.store_credential(
        "tenant-1", "tester", integration_id=iid, kind="api_key", secret="first-secret"
    )
    rotated = await svc.rotate_credential("tenant-1", "tester", cred.id, "second-secret")
    assert rotated is not None
    assert rotated.rotated_at is not None
    assert svc.vault.decrypt(rotated.secret_encrypted) == "second-secret"


@pytest.mark.asyncio
async def test_connection_test(session) -> None:
    svc = IntegrationService(session)
    iid = await _make_integration(svc, "tenant-1")
    await svc.store_credential(
        "tenant-1", "tester", integration_id=iid, kind="api_key", secret="abc"
    )
    result = await svc.test_connection("tenant-1", iid)
    assert result.ok is True


@pytest.mark.asyncio
async def test_sync_run_records_job_and_history(session) -> None:
    svc = IntegrationService(session)
    iid = await _make_integration(svc, "tenant-1")
    job = await svc.run_sync("tenant-1", "tester", integration_id=iid, mode="manual")
    assert job.status in {"succeeded", "partial"}
    jobs = await svc.list_sync_jobs("tenant-1", iid)
    assert len(jobs) == 1


@pytest.mark.asyncio
async def test_webhook_endpoint_and_inbound_idempotency(session) -> None:
    svc = IntegrationService(session)
    endpoint = await svc.create_endpoint(
        "tenant-1", "tester", direction="inbound", url=None,
        event_types=["backlink.lost"], secret="whsec", active=True, filters={},
        description=None,
    )
    payload = {"id": "b1"}
    ts = int(time.time())
    sig = compute_signature("whsec", payload, ts)

    d1 = await svc.receive_inbound(
        "tenant-1", endpoint.id, event_type="backlink.lost", payload=payload,
        signature=sig, timestamp=ts, idempotency_key="key-1",
    )
    assert d1.status == "delivered"

    # Same idempotency key returns the existing delivery (no duplicate).
    d2 = await svc.receive_inbound(
        "tenant-1", endpoint.id, event_type="backlink.lost", payload=payload,
        signature=sig, timestamp=ts, idempotency_key="key-1",
    )
    assert d2.id == d1.id


@pytest.mark.asyncio
async def test_inbound_rejects_bad_signature(session) -> None:
    svc = IntegrationService(session)
    endpoint = await svc.create_endpoint(
        "tenant-1", "tester", direction="inbound", url=None,
        event_types=["backlink.lost"], secret="whsec", active=True, filters={},
        description=None,
    )
    with pytest.raises(ValueError):
        await svc.receive_inbound(
            "tenant-1", endpoint.id, event_type="backlink.lost", payload={"x": 1},
            signature="bad", timestamp=int(time.time()), idempotency_key=None,
        )


@pytest.mark.asyncio
async def test_outbound_publish_event_fanout(session, monkeypatch) -> None:
    svc = IntegrationService(session)
    endpoint = await svc.create_endpoint(
        "tenant-1", "tester", direction="outbound", url="https://hooks.example.com/x",
        event_types=["workflow.completed"], secret=None, active=True, filters={},
        description=None,
    )

    async def fake_deliver(url, payload, headers):
        return 200, "ok"

    monkeypatch.setattr(svc.webhooks, "_deliver_http", fake_deliver)
    deliveries = await svc.publish_event("tenant-1", "workflow.completed", {"wf": "1"})
    assert len(deliveries) == 1
    assert deliveries[0].status == "delivered"
    assert deliveries[0].endpoint_id == endpoint.id


@pytest.mark.asyncio
async def test_health_check(session) -> None:
    svc = IntegrationService(session)
    iid = await _make_integration(svc, "tenant-1")
    await svc.store_credential(
        "tenant-1", "tester", integration_id=iid, kind="api_key", secret="abc"
    )
    record = await svc.check_health("tenant-1", iid)
    assert record.status == "healthy"
    latest = await svc.latest_health("tenant-1", iid)
    assert latest is not None and latest.integration_id == iid


@pytest.mark.asyncio
async def test_tenant_isolation(session) -> None:
    svc = IntegrationService(session)
    iid = await _make_integration(svc, "tenant-1")
    # Another tenant cannot see tenant-1's integration.
    assert await svc.get_integration("tenant-2", iid) is None
    assert await svc.list_integrations("tenant-2") == []


@pytest.mark.asyncio
async def test_overview(session) -> None:
    svc = IntegrationService(session)
    await _make_integration(svc, "tenant-1")
    overview = await svc.overview("tenant-1")
    assert overview.total_integrations == 1
    assert "google_search_console" in overview.supported_connector_types
