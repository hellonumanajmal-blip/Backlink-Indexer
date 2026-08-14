"""API-level tests: REST endpoints, RBAC enforcement, tenant isolation, metrics."""
from __future__ import annotations

import pytest

BASE = "/api/integrations"


async def _create_integration(client, headers, name="GSC") -> str:
    resp = await client.post(
        BASE,
        json={"name": name, "connector_type": "google_search_console",
              "config": {"site_url": "https://example.com"}},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_overview_endpoint(client, auth_headers) -> None:
    resp = await client.get(BASE, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "total_integrations" in body
    assert "supported_connector_types" in body


@pytest.mark.asyncio
async def test_supported_events_endpoint(client, auth_headers) -> None:
    resp = await client.get(f"{BASE}/events", headers=auth_headers)
    assert resp.status_code == 200
    events = resp.json()
    assert "workflow.completed" in events
    assert "backlink.lost" in events
    assert "invoice.paid" in events


@pytest.mark.asyncio
async def test_create_and_get_integration(client, auth_headers) -> None:
    iid = await _create_integration(client, auth_headers)
    resp = await client.get(f"{BASE}/{iid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == iid


@pytest.mark.asyncio
async def test_create_integration_invalid_type(client, auth_headers) -> None:
    resp = await client.post(
        BASE, json={"name": "Bad", "connector_type": "nope", "config": {}},
        headers=auth_headers,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_update_and_delete_integration(client, auth_headers) -> None:
    iid = await _create_integration(client, auth_headers)
    resp = await client.patch(f"{BASE}/{iid}", json={"enabled": False}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "disabled"

    resp = await client.delete(f"{BASE}/{iid}", headers=auth_headers)
    assert resp.status_code == 204
    resp = await client.get(f"{BASE}/{iid}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_connector_types_endpoint(client, auth_headers) -> None:
    resp = await client.get(f"{BASE}/connectors/types", headers=auth_headers)
    assert resp.status_code == 200
    types = {c["connector_type"] for c in resp.json()}
    assert "slack" in types
    assert "generic_rest" in types


@pytest.mark.asyncio
async def test_credential_store_and_list(client, auth_headers) -> None:
    iid = await _create_integration(client, auth_headers)
    resp = await client.post(
        f"{BASE}/credentials",
        json={"integration_id": iid, "kind": "api_key", "secret": "sk-abc-123456"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert "secret" not in str(body).lower() or "sk-abc" not in str(body)
    assert body["masked_hint"] is not None

    resp = await client.get(f"{BASE}/credentials/{iid}", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_credential_rotate_endpoint(client, auth_headers) -> None:
    iid = await _create_integration(client, auth_headers)
    create = await client.post(
        f"{BASE}/credentials",
        json={"integration_id": iid, "kind": "api_key", "secret": "first"},
        headers=auth_headers,
    )
    cid = create.json()["id"]
    resp = await client.post(
        f"{BASE}/credentials/{cid}/rotate", json={"secret": "second"}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["rotated_at"] is not None


@pytest.mark.asyncio
async def test_connection_test_endpoint(client, auth_headers) -> None:
    iid = await _create_integration(client, auth_headers)
    await client.post(
        f"{BASE}/credentials",
        json={"integration_id": iid, "kind": "api_key", "secret": "abc"},
        headers=auth_headers,
    )
    resp = await client.post(f"{BASE}/credentials/test/{iid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_sync_endpoint(client, auth_headers) -> None:
    iid = await _create_integration(client, auth_headers)
    resp = await client.post(
        f"{BASE}/sync", json={"integration_id": iid, "mode": "manual"}, headers=auth_headers
    )
    assert resp.status_code == 202
    assert resp.json()["status"] in {"succeeded", "partial"}

    resp = await client.get(f"{BASE}/sync/{iid}", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_webhook_endpoint_crud(client, auth_headers) -> None:
    resp = await client.post(
        f"{BASE}/webhooks/endpoints",
        json={"direction": "outbound", "url": "https://hooks.example.com/x",
              "event_types": ["workflow.completed"], "active": True},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    eid = resp.json()["id"]

    resp = await client.get(f"{BASE}/webhooks/endpoints", headers=auth_headers)
    assert resp.status_code == 200
    assert any(e["id"] == eid for e in resp.json())


@pytest.mark.asyncio
async def test_health_endpoint(client, auth_headers) -> None:
    iid = await _create_integration(client, auth_headers)
    await client.post(
        f"{BASE}/credentials",
        json={"integration_id": iid, "kind": "api_key", "secret": "abc"},
        headers=auth_headers,
    )
    resp = await client.post(f"{BASE}/health/{iid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"

    resp = await client.get(f"{BASE}/health/{iid}", headers=auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_rbac_forbidden_for_viewer(client, tenant_id) -> None:
    from app.auth import create_access_token

    viewer = create_access_token("viewer-1", tenant_id, roles=["viewer"])
    headers = {"Authorization": f"Bearer {viewer}"}
    # viewer has integrations:read but not integrations:write
    resp = await client.post(
        BASE, json={"name": "X", "connector_type": "slack", "config": {}}, headers=headers
    )
    assert resp.status_code == 403
    # but can read
    resp = await client.get(BASE, headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_tenant_isolation_via_api(client, auth_headers, other_tenant_headers) -> None:
    iid = await _create_integration(client, auth_headers, name="Tenant1Integration")
    # Other tenant cannot access tenant-1's integration.
    resp = await client.get(f"{BASE}/{iid}", headers=other_tenant_headers)
    assert resp.status_code == 404
    resp = await client.get(f"{BASE}/list", headers=other_tenant_headers)
    assert resp.status_code == 200
    assert all(i["id"] != iid for i in resp.json())


@pytest.mark.asyncio
async def test_metrics_endpoint_exposes_integration_metrics(client, auth_headers) -> None:
    await _create_integration(client, auth_headers)
    resp = await client.get("/metrics")
    assert resp.status_code == 200
    text = resp.text
    assert "integrations_total" in text
