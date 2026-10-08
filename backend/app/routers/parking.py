from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.parking_zone import ParkingZoneCreate, ParkingZoneResponse, ParkingZoneUpdate
from app.services.parking import (
    create_parking_zone,
    delete_parking_zone,
    get_parking_zone_or_404,
    list_parking_zones,
    update_parking_zone,
)

router = APIRouter(prefix="/parking", tags=["Parking"])


@router.get("", response_model=list[ParkingZoneResponse])
def get_parking_zones(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_parking_zones(db)


@router.get("/{zone_id}", response_model=ParkingZoneResponse)
def get_parking_zone(
    zone_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_parking_zone_or_404(db, zone_id)


@router.post("", response_model=ParkingZoneResponse, status_code=201)
def create_parking_zone_route(
    request: ParkingZoneCreate,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return create_parking_zone(db, request)


@router.put("/{zone_id}", response_model=ParkingZoneResponse)
def update_parking_zone_route(
    zone_id: int,
    request: ParkingZoneUpdate,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return update_parking_zone(db, zone_id, request)


@router.delete("/{zone_id}")
def delete_parking_zone_route(
    zone_id: int,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    delete_parking_zone(db, zone_id)
    return {"message": "Parking zone deleted successfully"}
