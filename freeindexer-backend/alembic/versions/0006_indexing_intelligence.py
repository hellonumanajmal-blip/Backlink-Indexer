"""Placeholder revision for the indexing_intelligence module.

The module has no implemented models, so this revision creates no schema. It
exists to keep the Alembic revision chain contiguous between 0001 and 0014.

Revision ID: 0006
Revises: 0005
"""
from typing import Sequence, Union

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
