"""Unit tests for the credential vault and webhook signature helpers."""
from __future__ import annotations

import time

from app.modules.integrations.credential_vault import CredentialVault
from app.modules.integrations.webhook_platform import (
    WebhookPlatform,
    compute_signature,
    verify_signature,
)


def test_encrypt_decrypt_roundtrip() -> None:
    vault = CredentialVault()
    token = vault.encrypt("super-secret-value")
    assert token != "super-secret-value"
    assert vault.decrypt(token) == "super-secret-value"


def test_masked_hint_does_not_expose_secret() -> None:
    vault = CredentialVault()
    hint = vault.hint("sk-live-abcdef123456")
    assert "abcdef" not in hint
    assert hint.endswith("3456")
    assert set(hint[:-4]) == {"*"}


def test_rotate_produces_new_token() -> None:
    vault = CredentialVault()
    token1, _ = vault.rotate("first")
    token2, hint2 = vault.rotate("second")
    assert token1 != token2
    assert vault.decrypt(token2) == "second"
    assert hint2.endswith("cond")


def test_is_expired() -> None:
    from datetime import datetime, timedelta, timezone

    assert CredentialVault.is_expired(None) is False
    past = datetime.now(timezone.utc) - timedelta(days=1)
    future = datetime.now(timezone.utc) + timedelta(days=1)
    assert CredentialVault.is_expired(past) is True
    assert CredentialVault.is_expired(future) is False


def test_signature_roundtrip() -> None:
    secret = "whsec_test"
    payload = {"event": "backlink.lost", "id": "123"}
    ts = int(time.time())
    sig = compute_signature(secret, payload, ts)
    ok, reason = verify_signature(secret, payload, sig, ts)
    assert ok, reason


def test_signature_rejects_tampering() -> None:
    secret = "whsec_test"
    payload = {"event": "backlink.lost"}
    ts = int(time.time())
    sig = compute_signature(secret, payload, ts)
    ok, _ = verify_signature(secret, {"event": "backlink.recovered"}, sig, ts)
    assert ok is False


def test_signature_rejects_replay_old_timestamp() -> None:
    secret = "whsec_test"
    payload = {"event": "x"}
    old_ts = int(time.time()) - 10000
    sig = compute_signature(secret, payload, old_ts)
    ok, reason = verify_signature(secret, payload, sig, old_ts)
    assert ok is False
    assert "replay" in reason


def test_retry_backoff() -> None:
    platform = WebhookPlatform(max_retries=5)
    assert platform.should_retry(1) is True
    assert platform.should_retry(5) is False
    assert platform.next_retry_delay_seconds(1) >= 5
    assert platform.next_retry_delay_seconds(10) <= 900
