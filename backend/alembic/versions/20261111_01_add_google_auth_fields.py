from alembic import op
import sqlalchemy as sa


revision = "20261111_01"
down_revision = "20261109_01"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"]: column for column in inspector.get_columns("users")}

    with op.batch_alter_table("users") as batch_op:
        if "phone" in columns and columns["phone"]["nullable"] is False:
            batch_op.alter_column(
                "phone",
                existing_type=columns["phone"]["type"],
                nullable=True,
            )
        if "email" in columns:
            batch_op.alter_column(
                "email",
                existing_type=columns["email"]["type"],
                type_=sa.String(length=254),
                existing_nullable=columns["email"]["nullable"],
            )
        if "google_id" not in columns:
            batch_op.add_column(sa.Column("google_id", sa.String(length=255), nullable=True))
        if "google_picture_url" not in columns:
            batch_op.add_column(sa.Column("google_picture_url", sa.String(length=512), nullable=True))
        if "google_email_verified" not in columns:
            batch_op.add_column(
                sa.Column(
                    "google_email_verified",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                )
            )

    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ix_users_google_id" not in indexes:
        op.create_index("ix_users_google_id", "users", ["google_id"], unique=True)


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "users" not in tables:
        return

    columns = {column["name"]: column for column in inspector.get_columns("users")}
    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ix_users_google_id" in indexes:
        op.drop_index("ix_users_google_id", table_name="users")
    with op.batch_alter_table("users") as batch_op:
        for column in ("google_email_verified", "google_picture_url", "google_id"):
            if column in columns:
                batch_op.drop_column(column)
        if "email" in columns:
            batch_op.alter_column(
                "email",
                existing_type=columns["email"]["type"],
                type_=sa.String(length=50),
                existing_nullable=columns["email"]["nullable"],
            )
        if "phone" in columns and columns["phone"]["nullable"] is True:
            batch_op.alter_column(
                "phone",
                existing_type=columns["phone"]["type"],
                nullable=False,
            )
