from alembic import op
import sqlalchemy as sa


revision = "20261022_01"
down_revision = "20261016_01"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    cols = [c["name"] for c in sa.inspect(bind).get_columns("fund_requests")]
    if "eligibility_snapshot" in cols:
        return
    op.add_column("fund_requests", sa.Column("eligibility_snapshot", sa.Text(), nullable=True))


def downgrade():
    bind = op.get_bind()
    cols = [c["name"] for c in sa.inspect(bind).get_columns("fund_requests")]
    if "eligibility_snapshot" in cols:
        op.drop_column("fund_requests", "eligibility_snapshot")