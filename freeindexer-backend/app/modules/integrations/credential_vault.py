"""Credential vault: encryption, masking, rotation, and expiry monitoring.

Uses Fernet symmetric encryption. The key comes from
``settings.credential_encryption_key`` or is derived from ``settings.secret_key``.
Plaintext secrets are never persisted; only the Fernet token and a masked hint.
"""
from __future__ import annotations

import base64
import hashlib
from datetime import datetime, timezone
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.audit import mask_secret
from app.core.config import settings


def _derive_key() -> bytes:
    if settings.credential_encryption_key:
        key = settings.credential_encryption_key.encode()
        # Ensure valid Fernet key (32 urlsafe base64 bytes).
        try:
            Fernet(key)
            return key
        except Exception:
            pass
    digest = hashlib.sha256(settings.secret_key.encode()).digest()
    return base64.urlsafe_b64encode(digest)


class CredentialVault:
    """Encrypts/decrypts secrets and produces masked hints."""

    def __init__(self, key: Optional[bytes] = None) -> None:
        self._fernet = Fernet(key or _derive_key())

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, token: str) -> str:
        try:
            return self._fernet.decrypt(token.encode()).decode()
        except InvalidToken as exc:
            raise ValueError("Unable to decrypt credential") from exc

    @staticmethod
    def hint(plaintext: str) -> str:
        return mask_secret(plaintext) or ""

    def rotate(self, new_plaintext: str) -> tuple[str, str]:
        """Return (encrypted_token, masked_hint) for a rotated secret."""
        return self.encrypt(new_plaintext), self.hint(new_plaintext)

    @staticmethod
    def is_expired(expires_at: Optional[datetime]) -> bool:
        if expires_at is None:
            return False
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return expires_at <= datetime.now(timezone.utc)


_vault: Optional[CredentialVault] = None


def get_vault() -> CredentialVault:
    global _vault
    if _vault is None:
        _vault = CredentialVault()
    return _vault
