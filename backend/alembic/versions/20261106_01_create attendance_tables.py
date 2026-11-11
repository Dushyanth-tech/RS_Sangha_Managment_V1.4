from alembic import op
import sqlalchemy as sa


revision = "20261106_01"
down_revision = "20261022_01"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing = sa.inspect(bind).get_table_names()

    if "attendance_sessions" not in existing:
        op.create_table(
            "attendance_sessions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("sangha_id", sa.Integer(), sa.ForeignKey("sanghas.id"), nullable=False, index=True),
            sa.Column("meeting_date", sa.Date(), nullable=False),
            sa.Column("fine_per_head", sa.Numeric(8, 2), nullable=False),
            sa.Column("taken_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("sangha_id", "meeting_date", name="uq_attendance_sangha_date"),
        )

    if "attendance_records" not in existing:
        op.create_table(
            "attendance_records",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "session_id", sa.Integer(),
                sa.ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False, index=True,
            ),
            sa.Column("member_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("present", sa.Boolean(), nullable=False),
            sa.Column("fine_amount", sa.Numeric(8, 2), nullable=False, server_default="0"),
            sa.UniqueConstraint("session_id", "member_id", name="uq_attendance_session_member"),
            sa.CheckConstraint("fine_amount >= 0", name="ck_attendance_fine_non_negative"),
        )


def downgrade():
    bind = op.get_bind()
    existing = sa.inspect(bind).get_table_names()
    if "attendance_records" in existing:
        op.drop_table("attendance_records")
    if "attendance_sessions" in existing:
        op.drop_table("attendance_sessions")