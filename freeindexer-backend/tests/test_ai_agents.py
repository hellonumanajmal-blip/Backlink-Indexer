from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_ai_agents_overview_endpoint(client, auth_headers):
    response = await client.get("/api/ai/overview", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["agents_total"] >= 0
    assert body["providers_total"] >= 0
