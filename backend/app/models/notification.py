from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Enum, ForeignKey
from sqlalchemy.sql import func

from app.db.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    target_role = Column(
        Enum("STUDENT", "FACULTY_STAFF", "ADMIN"),
        nullable=True,
    )

    type = Column(
        Enum(
            "RESERVATION_CONFIRMED",
            "RESERVATION_REMINDER",
            "ARRIVAL_WINDOW_OPEN",
            "EXPIRY_WARNING",
            "NO_SHOW_RELEASED",
            "RESERVATION_CANCELLED",
            "EVENT_REMINDER",
            "CAMPUS_ANNOUNCEMENT",
            "CROWD_ALERT",
        ),
        nullable=False,
    )

    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)

    related_id = Column(Integer, nullable=True)

    read_status = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )