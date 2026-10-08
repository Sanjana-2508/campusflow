from sqlalchemy import Column, Integer, String, DECIMAL, Enum

from app.db.base import Base


class ParkingZone(Base):
    __tablename__ = "parking_zones"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String(150), nullable=False)

    car_capacity = Column(Integer, nullable=False)
    bike_capacity = Column(Integer, nullable=False)

    staff_reserved_car = Column(Integer, nullable=False, default=0)
    staff_reserved_bike = Column(Integer, nullable=False, default=0)

    lat = Column(DECIMAL(10, 7), nullable=False)
    lng = Column(DECIMAL(10, 7), nullable=False)

    status = Column(
        Enum("OPEN", "CLOSED"),
        nullable=False,
        default="OPEN",
    )