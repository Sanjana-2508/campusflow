from sqlalchemy import Column, Integer, String, Text, Date, Time, Enum, ForeignKey

from app.db.base import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    organizer_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )

    club_id = Column(
        Integer,
        ForeignKey("clubs.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )

    venue = Column(String(200), nullable=True)

    venue_building_id = Column(
        Integer,
        ForeignKey("buildings.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )

    event_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    poster = Column(String(500), nullable=True)
    registration_url = Column(String(500), nullable=True)
    qr_code = Column(String(500), nullable=True)

    expected_attendance = Column(Integer, nullable=True)

    status = Column(
        Enum("DRAFT", "PUBLISHED", "CANCELLED", "REMOVED"),
        nullable=False,
        default="DRAFT",
    )
