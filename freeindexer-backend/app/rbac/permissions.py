"""Role-based access control.

Lean permission model: roles map to permission strings; FastAPI dependencies
enforce them per-endpoint. Designed to be replaced by a fuller RBAC module
without changing call sites.
"""
from __future__ import annotations

from typing import Callable, Iterable, Set

from fastapi import Depends, HTTPException, status

from app.auth import Principal, get_current_principal

# role -> permissions ("*" = all)
ROLE_PERMISSIONS: dict[str, Set[str]] = {
    "admin": {"*"},
    "integrations:manager": {
        "integrations:read",
        "integrations:write",
        "integrations:credentials",
        "integrations:sync",
        "integrations:webhooks",
        "integrations:admin",
        "indexing:read",
        "indexing:write",
        "knowledge:read",
        "knowledge:write",
        "observability:read",
        "observability:write",
    },
    "integrations:viewer": {
        "integrations:read",
        "indexing:read",
        "knowledge:read",
        "observability:read",
    },
    "viewer": {
        "integrations:read",
        "indexing:read",
        "knowledge:read",
        "observability:read",
    },
    "indexing:operator": {
        "indexing:read",
        "indexing:write",
    },
    "observability:operator": {
        "observability:read",
        "observability:write",
    },
    "observability:admin": {
        "observability:read",
        "observability:write",
        "observability:admin",
    },
}


def permissions_for_roles(roles: Iterable[str]) -> Set[str]:
    perms: Set[str] = set()
    for role in roles:
        perms |= ROLE_PERMISSIONS.get(role, set())
    return perms


def principal_has_permission(principal: Principal, permission: str) -> bool:
    perms = permissions_for_roles(principal.roles)
    return "*" in perms or permission in perms


def require_permission(permission: str) -> Callable:
    """FastAPI dependency factory enforcing a permission."""

    async def _checker(
        principal: Principal = Depends(get_current_principal),
    ) -> Principal:
        if not principal_has_permission(principal, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission}",
            )
        return principal

    return _checker
