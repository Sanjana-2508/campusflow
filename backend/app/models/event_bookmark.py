from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.sql import func

from app.db.base import Base


class EventBookmark(Base):
    __tablename__ = "event_bookmarks"

    id = Column(Integer, primary_key=True, autoincrement=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )

    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "event_id",
            name="uq_user_event_bookmark",
        ),
    )