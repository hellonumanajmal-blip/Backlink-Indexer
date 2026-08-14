from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_ai_platform_support_endpoints(client, auth_headers):
    for path in [
        "/api/ai/tools",
        "/api/ai/providers",
        "/api/ai/mcp/servers",
        "/api/ai/knowledge",
        "/api/ai/prompts",
        "/api/ai/health",
    ]:
        response = await client.get(path, headers=auth_headers)
        assert response.status_code == 200, path


@pytest.mark.asyncio
async def test_ai_platform_tool_execution(client, auth_headers):
    response = await client.post(
        "/api/ai/tools/execute",
        headers=auth_headers,
        json={"tool": "search", "input": {"query": "backlinks"}},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"ok", "accepted"}
