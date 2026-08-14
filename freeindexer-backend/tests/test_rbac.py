"""RBAC regression coverage including Phase 34 observability permissions."""
from __future__ import annotations

from app.rbac.permissions import (
    ROLE_PERMISSIONS,
    permissions_for_roles,
    principal_has_permission,
)
from app.auth import Principal


def test_admin_has_all_permissions():
    principal = Principal(user_id="u", tenant_id="t", roles=["admin"])
    assert principal_has_permission(principal, "observability:admin")
    assert principal_has_permission(principal, "knowledge:write")


def test_viewer_can_read_observability_but_not_admin():
    perms = permissions_for_roles(["viewer"])
    assert "observability:read" in perms
    assert "observability:admin" not in perms


def test_observability_roles_registered():
    assert "observability:operator" in ROLE_PERMISSIONS
    assert "observability:admin" in ROLE_PERMISSIONS
    assert "observability:write" in ROLE_PERMISSIONS["observability:operator"]
    assert "observability:admin" in ROLE_PERMISSIONS["observability:admin"]
