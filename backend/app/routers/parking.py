from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.parking_reservation import ParkingReservationCreate, ParkingReservationResponse
from app.schemas.parking_zone import ParkingZoneCreate, ParkingZoneResponse, ParkingZoneUpdate
from app.services.parking import (
    calculate_available_spaces,
    cancel_reservation,
    check_in_reservation,
    complete_reservation,
    create_parking_zone,
    create_reservation,
    delete_parking_zone,
    get_parking_zone_or_404,
    list_my_reservations,
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


@router.get("/{zone_id}/availability")
def get_parking_zone_availability(
    zone_id: int,
    vehicle_type: str = Query(..., description="CAR or TWO_WHEELER"),
    requested_at: datetime | None = Query(default=None, description="Optional requested arrival time in UTC"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    normalized_vehicle_type = vehicle_type.upper()
    if normalized_vehicle_type not in ("CAR", "TWO_WHEELER"):
        raise HTTPException(status_code=400, detail="Invalid vehicle type")

    zone = get_parking_zone_or_404(db, zone_id)
    available_spaces = calculate_available_spaces(
        db,
        zone.id,
        normalized_vehicle_type,
        current_user.role,
        requested_at=requested_at,
    )
    return {
        "parking_zone_id": zone.id,
        "zone_name": zone.name,
        "status": zone.status,
        "vehicle_type": normalized_vehicle_type,
        "available_spaces": available_spaces,
    }


@router.post("/reserve", response_model=ParkingReservationResponse, status_code=201)
def reserve_parking_space(
    request: ParkingReservationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_reservation(db, current_user, request)


@router.get("/reservations/me", response_model=list[ParkingReservationResponse])
def get_my_reservations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_my_reservations(db, current_user.id)


@router.post("/reservations/{reservation_id}/cancel", response_model=ParkingReservationResponse)
def cancel_parking_reservation(
    reservation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return cancel_reservation(db, reservation_id, current_user)


@router.post("/reservations/{reservation_id}/check-in", response_model=ParkingReservationResponse)
def check_in_parking_reservation(
    reservation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return check_in_reservation(db, reservation_id, current_user)


@router.post("/reservations/{reservation_id}/complete", response_model=ParkingReservationResponse)
def complete_parking_reservation(
    reservation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return complete_reservation(db, reservation_id, current_user)
