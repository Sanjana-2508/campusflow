from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.sql import func

from app.db.base import Base


class LostFound(Base):
    __tablename__ = "lost_found"

    id = Column(Integer, primary_key=True, autoincrement=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    type = Column(
        Enum("LOST", "FOUND"),
        nullable=False,
    )

    item_name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)

    location = Column(String(200), nullable=True)

    item_date = Column(DateTime, nullable=True)

    image = Column(String(500), nullable=True)

    contact = Column(String(200), nullable=True)

    status = Column(
        Enum("OPEN", "RESOLVED", "REMOVED"),
        nullable=False,
        default="OPEN",
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )