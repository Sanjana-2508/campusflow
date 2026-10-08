from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint

from app.db.base import Base


class EventBookmark(Base):
    __tablename__ = "event_bookmarks"

    id = Column(Integer, primary_key=True, autoincrement=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    event_id = Column(
        Integer,
        ForeignKey("events.id"),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "event_id",
            name="uq_user_event_bookmark",
        ),
    )