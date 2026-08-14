from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_knowledge_document_lifecycle(client, auth_headers):
    response = await client.get("/api/knowledge/documents", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []

    create_payload = {
        "title": "Test Knowledge Doc",
        "content": "This is a sample knowledge document for integration testing.",
        "source_uri": "https://example.com/guide",
        "metadata": {"document_type": "markdown"},
    }
    create_response = await client.post(
        "/api/knowledge/documents",
        headers=auth_headers,
        json=create_payload,
    )
    assert create_response.status_code == 201
    body = create_response.json()
    assert body["id"]
    assert body["status"] == "indexed"

    document_id = body["id"]
    get_response = await client.get(f"/api/knowledge/documents/{document_id}", headers=auth_headers)
    assert get_response.status_code == 200
    doc_body = get_response.json()
    assert doc_body["id"] == document_id
    assert doc_body["title"] == create_payload["title"]
    assert doc_body["content"] == create_payload["content"]
    assert doc_body["source_uri"] == create_payload["source_uri"]

    search_response = await client.post(
        "/api/knowledge/search",
        headers=auth_headers,
        json={"query": "sample"},
    )
    assert search_response.status_code == 200
    assert isinstance(search_response.json(), list)

    log_response = await client.post(
        "/api/knowledge/logs",
        headers=auth_headers,
        json={"query": "sample", "results": [{"id": document_id}], "metadata": {"source": "unittest"}},
    )
    assert log_response.status_code == 204
