from alembic import op
import sqlalchemy as sa


revision = "20261109_01"
down_revision = "20261106_01"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "user_notification_preferences" not in tables:
        op.create_table(
            "user_notification_preferences",
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column("in_app_notifications", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("email_notifications", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("payment_reminders", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("attendance_notifications", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("emergency_request_updates", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("loan_repayment_reminders", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("account_verification_updates", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("important_announcements", sa.Boolean(), nullable=False, server_default=sa.true()),
        )

    if "notifications" in tables:
        columns = {column["name"] for column in inspector.get_columns("notifications")}
        if "preference_category" not in columns:
            op.add_column(
                "notifications",
                sa.Column("preference_category", sa.String(length=40), nullable=True),
            )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "user_notification_preferences" in tables:
        op.drop_table("user_notification_preferences")

    if "notifications" in tables:
        columns = {column["name"] for column in inspector.get_columns("notifications")}
        if "preference_category" in columns:
            with op.batch_alter_table("notifications") as batch_op:
                batch_op.drop_column("preference_category")
