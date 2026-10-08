from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.sql import func

from app.db.base import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    organizer_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    club_id = Column(
        Integer,
        ForeignKey("clubs.id"),
        nullable=True,
    )

    venue = Column(String(200), nullable=True)

    venue_building_id = Column(
        Integer,
        ForeignKey("buildings.id"),
        nullable=True,
    )

    event_date = Column(DateTime, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)

    poster = Column(String(500), nullable=True)
    registration_url = Column(String(500), nullable=True)
    qr = Column(String(500), nullable=True)

    expected_attendance = Column(Integer, nullable=True)

    status = Column(
        Enum("DRAFT", "PUBLISHED", "CANCELLED", "REMOVED"),
        nullable=False,
        default="DRAFT",
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )