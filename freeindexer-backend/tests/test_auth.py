"""API-level tests for real authentication: signup, login, me."""
from __future__ import annotations

import pytest

BASE = "/api/auth"

SIGNUP = {"name": "Test User", "email": "test@example.com", "password": "password123"}


@pytest.mark.asyncio
async def test_signup_creates_user(client) -> None:
    resp = await client.post(f"{BASE}/signup", json=SIGNUP)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "test@example.com"
    assert body["user"]["name"] == "Test User"
    assert body["user"]["role"] == "user"


@pytest.mark.asyncio
async def test_signup_rejects_duplicate_email(client) -> None:
    first = await client.post(f"{BASE}/signup", json=SIGNUP)
    assert first.status_code == 201
    second = await client.post(f"{BASE}/signup", json=SIGNUP)
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_signup_rejects_short_password(client) -> None:
    resp = await client.post(f"{BASE}/signup", json={**SIGNUP, "password": "short"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_signup_rejects_invalid_email(client) -> None:
    resp = await client.post(f"{BASE}/signup", json={**SIGNUP, "email": "not-an-email"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client) -> None:
    await client.post(f"{BASE}/signup", json=SIGNUP)
    resp = await client.post(f"{BASE}/login", json={"email": SIGNUP["email"], "password": SIGNUP["password"]})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["access_token"]
    assert body["user"]["email"] == SIGNUP["email"]


@pytest.mark.asyncio
async def test_login_wrong_password(client) -> None:
    await client.post(f"{BASE}/signup", json=SIGNUP)
    resp = await client.post(f"{BASE}/login", json={"email": SIGNUP["email"], "password": "wrong-password"})
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_login_unknown_email(client) -> None:
    resp = await client.post(f"{BASE}/login", json={"email": "nobody@example.com", "password": "password123"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_with_token(client) -> None:
    signup = await client.post(f"{BASE}/signup", json=SIGNUP)
    token = signup.json()["access_token"]
    resp = await client.get(f"{BASE}/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_me_without_valid_session(client) -> None:
    # Development mode without a bearer token resolves a dev principal that
    # does not exist in the DB, so the endpoint must reject it.
    resp = await client.get(f"{BASE}/me")
    assert resp.status_code == 401
