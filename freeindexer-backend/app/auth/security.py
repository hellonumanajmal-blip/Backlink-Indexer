"""Authentication and security primitives.

Lean JWT-based auth used by the foundation. Provides password hashing,
token creation/verification, and FastAPI dependencies that resolve the
current authenticated principal (user id + tenant id + roles).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

_ph = PasswordHasher()
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def create_access_token(
    subject: str,
    tenant_id: str,
    roles: Optional[List[str]] = None,
    expires_minutes: Optional[int] = None,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    payload = {
        "sub": subject,
        "tenant_id": tenant_id,
        "roles": roles or [],
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])


@dataclass
class Principal:
    """Authenticated request principal."""

    user_id: str
    tenant_id: str
    roles: List[str] = field(default_factory=list)

    def has_role(self, role: str) -> bool:
        return role in self.roles or "admin" in self.roles


async def get_current_principal(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Principal:
    """Resolve the current principal from a bearer token.

    For local development and tests, if no credentials are supplied a
    development principal is returned. In production (environment != development)
    missing/invalid credentials raise 401.
    """
    if credentials is None:
        if settings.environment == "development":
            return Principal(user_id="dev-user", tenant_id="dev-tenant", roles=["admin"])
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials"
        )
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc
    return Principal(
        user_id=payload.get("sub", ""),
        tenant_id=payload.get("tenant_id", ""),
        roles=payload.get("roles", []),
    )
