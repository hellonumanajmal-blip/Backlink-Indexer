"""Placeholder revision for the index_verification module.

The module has no implemented models, so this revision creates no schema. It
exists to keep the Alembic revision chain contiguous between 0001 and 0014.

Revision ID: 0008
Revises: 0007
"""
from typing import Sequence, Union

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
