from sqlalchemy import Column, Integer, DateTime, Enum, ForeignKey
from sqlalchemy.sql import func

from app.db.base import Base


class ParkingReservation(Base):
    __tablename__ = "parking_reservations"

    id = Column(Integer, primary_key=True, autoincrement=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    parking_zone_id = Column(
        Integer,
        ForeignKey("parking_zones.id"),
        nullable=False,
    )

    vehicle_type = Column(
        Enum("CAR", "TWO_WHEELER"),
        nullable=False,
    )

    status = Column(
        Enum(
            "RESERVED",
            "ACTIVE",
            "COMPLETED",
            "CANCELLED",
            "NO_SHOW",
        ),
        nullable=False,
        default="RESERVED",
    )

    reserved_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )

    requested_arrival_at = Column(
        DateTime,
        nullable=False,
    )

    arrival_deadline = Column(
        DateTime,
        nullable=False,
    )

    checked_in_at = Column(
        DateTime,
        nullable=True,
    )

    completed_at = Column(
        DateTime,
        nullable=True,
    )

    cancelled_at = Column(
        DateTime,
        nullable=True,
    )

    no_show_at = Column(
        DateTime,
        nullable=True,
    )