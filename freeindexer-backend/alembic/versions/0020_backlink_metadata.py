"""Editorial metadata columns on backlinks

Adds the dashboard-owned fields (platform, country, language, rel_type,
authority_score). All nullable so existing rows are unaffected and the
dispatch pipeline, which never reads them, keeps working unchanged.

Revision ID: 0020
Revises: 0019
Create Date: 2026-08-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("backlinks", sa.Column("platform", sa.String(80), nullable=True))
    op.add_column("backlinks", sa.Column("country", sa.String(80), nullable=True))
    op.add_column("backlinks", sa.Column("language", sa.String(80), nullable=True))
    op.add_column("backlinks", sa.Column("rel_type", sa.String(40), nullable=True))
    op.add_column("backlinks", sa.Column("authority_score", sa.Integer(), nullable=True))
    op.create_index("ix_backlinks_platform", "backlinks", ["platform"])


def downgrade() -> None:
    op.drop_index("ix_backlinks_platform", table_name="backlinks")
    op.drop_column("backlinks", "authority_score")
    op.drop_column("backlinks", "rel_type")
    op.drop_column("backlinks", "language")
    op.drop_column("backlinks", "country")
    op.drop_column("backlinks", "platform")
