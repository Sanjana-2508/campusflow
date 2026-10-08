from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.parking_zone import ParkingZone
from app.schemas.parking_zone import ParkingZoneCreate, ParkingZoneUpdate


def _to_decimal(value: float) -> Decimal:
    return Decimal(str(value))


def get_parking_zone_or_404(db: Session, zone_id: int) -> ParkingZone:
    parking_zone = db.query(ParkingZone).filter(ParkingZone.id == zone_id).first()
    if not parking_zone:
        raise HTTPException(status_code=404, detail="Parking zone not found")
    return parking_zone


def list_parking_zones(db: Session):
    return db.query(ParkingZone).all()


def create_parking_zone(db: Session, parking_zone_data: ParkingZoneCreate) -> ParkingZone:
    parking_zone = ParkingZone(
        name=parking_zone_data.name,
        car_capacity=parking_zone_data.car_capacity,
        bike_capacity=parking_zone_data.bike_capacity,
        staff_reserved_car=parking_zone_data.staff_reserved_car,
        staff_reserved_bike=parking_zone_data.staff_reserved_bike,
        lat=_to_decimal(parking_zone_data.lat),
        lng=_to_decimal(parking_zone_data.lng),
        status=parking_zone_data.status,
    )
    db.add(parking_zone)
    db.commit()
    db.refresh(parking_zone)
    return parking_zone


def update_parking_zone(db: Session, zone_id: int, parking_zone_data: ParkingZoneUpdate) -> ParkingZone:
    parking_zone = get_parking_zone_or_404(db, zone_id)
    parking_zone.name = parking_zone_data.name
    parking_zone.car_capacity = parking_zone_data.car_capacity
    parking_zone.bike_capacity = parking_zone_data.bike_capacity
    parking_zone.staff_reserved_car = parking_zone_data.staff_reserved_car
    parking_zone.staff_reserved_bike = parking_zone_data.staff_reserved_bike
    parking_zone.lat = _to_decimal(parking_zone_data.lat)
    parking_zone.lng = _to_decimal(parking_zone_data.lng)
    parking_zone.status = parking_zone_data.status
    db.commit()
    db.refresh(parking_zone)
    return parking_zone


def delete_parking_zone(db: Session, zone_id: int) -> None:
    parking_zone = get_parking_zone_or_404(db, zone_id)
    db.delete(parking_zone)
    db.commit()
