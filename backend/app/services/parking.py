from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.parking_reservation import ParkingReservation
from app.models.parking_zone import ParkingZone
from app.models.user import User
from app.schemas.parking_reservation import ParkingReservationCreate
from app.services.notifications import create_notification


RESERVATION_GRACE_PERIOD_MINUTES = 15
OPEN_RESERVATION_STATUSES = ("RESERVED", "ACTIVE")


def _to_decimal(value: float) -> Decimal:
    return Decimal(str(value))


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _validate_parking_zone_data(parking_zone_data) -> None:
    if parking_zone_data.status and parking_zone_data.status.upper() not in (
        "OPEN",
        "CLOSED",
    ):
        raise HTTPException(
            status_code=400,
            detail="Parking zone status must be OPEN or CLOSED",
        )

    if parking_zone_data.car_capacity < 0:
        raise HTTPException(
            status_code=400,
            detail="Car capacity cannot be negative",
        )

    if parking_zone_data.bike_capacity < 0:
        raise HTTPException(
            status_code=400,
            detail="Bike capacity cannot be negative",
        )

    if parking_zone_data.staff_reserved_car < 0:
        raise HTTPException(
            status_code=400,
            detail="Staff reserved car spaces cannot be negative",
        )

    if parking_zone_data.staff_reserved_bike < 0:
        raise HTTPException(
            status_code=400,
            detail="Staff reserved bike spaces cannot be negative",
        )

    if parking_zone_data.staff_reserved_car > parking_zone_data.car_capacity:
        raise HTTPException(
            status_code=400,
            detail="Staff reserved car spaces cannot exceed car capacity",
        )

    if parking_zone_data.staff_reserved_bike > parking_zone_data.bike_capacity:
        raise HTTPException(
            status_code=400,
            detail="Staff reserved bike spaces cannot exceed bike capacity",
        )


def _reservation_overlaps_requested_window(
    reservation: ParkingReservation,
    requested_at: datetime,
    requested_deadline: datetime,
) -> bool:
    if reservation.status not in OPEN_RESERVATION_STATUSES:
        return False

    reservation_start = _ensure_utc(reservation.requested_arrival_at)
    reservation_end = _ensure_utc(reservation.arrival_deadline)

    if reservation.status == "RESERVED" and requested_at > reservation_end:
        return False

    return (
        reservation_start < requested_deadline
        and requested_at < reservation_end
    )


def get_parking_zone_or_404(
    db: Session,
    zone_id: int,
) -> ParkingZone:
    parking_zone = (
        db.query(ParkingZone)
        .filter(ParkingZone.id == zone_id)
        .first()
    )

    if not parking_zone:
        raise HTTPException(
            status_code=404,
            detail="Parking zone not found",
        )

    return parking_zone


def list_parking_zones(db: Session):
    return db.query(ParkingZone).all()


def create_parking_zone(
    db: Session,
    parking_zone_data,
) -> ParkingZone:
    _validate_parking_zone_data(parking_zone_data)

    parking_zone = ParkingZone(
        name=parking_zone_data.name,
        car_capacity=parking_zone_data.car_capacity,
        bike_capacity=parking_zone_data.bike_capacity,
        staff_reserved_car=parking_zone_data.staff_reserved_car,
        staff_reserved_bike=parking_zone_data.staff_reserved_bike,
        lat=_to_decimal(parking_zone_data.lat),
        lng=_to_decimal(parking_zone_data.lng),
        status=parking_zone_data.status.upper(),
    )

    db.add(parking_zone)
    db.commit()
    db.refresh(parking_zone)

    return parking_zone


def update_parking_zone(
    db: Session,
    zone_id: int,
    parking_zone_data,
) -> ParkingZone:
    parking_zone = get_parking_zone_or_404(db, zone_id)

    _validate_parking_zone_data(parking_zone_data)

    parking_zone.name = parking_zone_data.name
    parking_zone.car_capacity = parking_zone_data.car_capacity
    parking_zone.bike_capacity = parking_zone_data.bike_capacity
    parking_zone.staff_reserved_car = parking_zone_data.staff_reserved_car
    parking_zone.staff_reserved_bike = parking_zone_data.staff_reserved_bike
    parking_zone.lat = _to_decimal(parking_zone_data.lat)
    parking_zone.lng = _to_decimal(parking_zone_data.lng)
    parking_zone.status = parking_zone_data.status.upper()

    db.commit()
    db.refresh(parking_zone)

    return parking_zone


def delete_parking_zone(
    db: Session,
    zone_id: int,
) -> None:
    parking_zone = get_parking_zone_or_404(db, zone_id)

    db.delete(parking_zone)
    db.commit()


def calculate_available_spaces(
    db: Session,
    parking_zone_id: int,
    vehicle_type: str,
    user_role: str,
    requested_at: datetime | None = None,
) -> int:

    if vehicle_type not in ("CAR", "TWO_WHEELER"):
        raise HTTPException(
            status_code=400,
            detail="Invalid vehicle type",
        )

    parking_zone = get_parking_zone_or_404(
        db,
        parking_zone_id,
    )

    request_time = (
        _ensure_utc(requested_at)
        if requested_at
        else _utc_now()
    )

    requested_deadline = (
        request_time
        + timedelta(minutes=RESERVATION_GRACE_PERIOD_MINUTES)
    )

    if vehicle_type == "CAR":
        total_capacity = int(parking_zone.car_capacity)
        staff_reserved = int(parking_zone.staff_reserved_car)
    else:
        total_capacity = int(parking_zone.bike_capacity)
        staff_reserved = int(parking_zone.staff_reserved_bike)

    if user_role == "STUDENT":
        usable_capacity = max(
            total_capacity - staff_reserved,
            0,
        )

        reservations = (
            db.query(ParkingReservation)
            .join(
                User,
                User.id == ParkingReservation.user_id,
            )
            .filter(
                ParkingReservation.parking_zone_id
                == parking_zone_id
            )
            .filter(
                ParkingReservation.vehicle_type
                == vehicle_type
            )
            .filter(
                ParkingReservation.status.in_(
                    OPEN_RESERVATION_STATUSES
                )
            )
            .filter(User.role == "STUDENT")
            .all()
        )

    else:
        usable_capacity = max(
            total_capacity,
            0,
        )

        reservations = (
            db.query(ParkingReservation)
            .filter(
                ParkingReservation.parking_zone_id
                == parking_zone_id
            )
            .filter(
                ParkingReservation.vehicle_type
                == vehicle_type
            )
            .filter(
                ParkingReservation.status.in_(
                    OPEN_RESERVATION_STATUSES
                )
            )
            .all()
        )

    reserved_count = 0

    for reservation in reservations:
        if _reservation_overlaps_requested_window(
            reservation,
            request_time,
            requested_deadline,
        ):
            reserved_count += 1

    available = usable_capacity - reserved_count

    return max(available, 0)


def get_reservation_or_404(
    db: Session,
    reservation_id: int,
) -> ParkingReservation:

    reservation = (
        db.query(ParkingReservation)
        .filter(ParkingReservation.id == reservation_id)
        .first()
    )

    if not reservation:
        raise HTTPException(
            status_code=404,
            detail="Reservation not found",
        )

    return reservation


def list_my_reservations(
    db: Session,
    user_id: int,
):
    return (
        db.query(ParkingReservation)
        .filter(
            ParkingReservation.user_id == user_id
        )
        .order_by(
            ParkingReservation.reserved_at.desc()
        )
        .all()
    )


def create_reservation(
    db: Session,
    current_user: User,
    reservation_data: ParkingReservationCreate,
) -> ParkingReservation:

    if reservation_data.vehicle_type not in (
        "CAR",
        "TWO_WHEELER",
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid vehicle type",
        )

    requested_arrival_at = _ensure_utc(
        reservation_data.requested_arrival_at
    )

    now = _utc_now()

    if requested_arrival_at <= now:
        raise HTTPException(
            status_code=400,
            detail="Requested arrival time must be in the future",
        )

    # Lock the parking zone row so two users cannot
    # reserve the same last available space simultaneously.
    parking_zone = (
        db.query(ParkingZone)
        .filter(
            ParkingZone.id
            == reservation_data.parking_zone_id
        )
        .with_for_update()
        .first()
    )

    if not parking_zone:
        raise HTTPException(
            status_code=404,
            detail="Parking zone not found",
        )

    if parking_zone.status != "OPEN":
        raise HTTPException(
            status_code=400,
            detail="Parking zone is closed",
        )

    if (
        parking_zone.car_capacity < 0
        or parking_zone.bike_capacity < 0
    ):
        raise HTTPException(
            status_code=400,
            detail="Parking capacity values cannot be negative",
        )

    if (
        parking_zone.staff_reserved_car < 0
        or parking_zone.staff_reserved_bike < 0
    ):
        raise HTTPException(
            status_code=400,
            detail="Staff reserved values cannot be negative",
        )

    if (
        parking_zone.staff_reserved_car
        > parking_zone.car_capacity
    ):
        raise HTTPException(
            status_code=400,
            detail="Staff reserved car spaces cannot exceed car capacity",
        )

    if (
        parking_zone.staff_reserved_bike
        > parking_zone.bike_capacity
    ):
        raise HTTPException(
            status_code=400,
            detail="Staff reserved bike spaces cannot exceed bike capacity",
        )

    open_reservation = (
        db.query(ParkingReservation)
        .filter(
            ParkingReservation.user_id
            == current_user.id
        )
        .filter(
            ParkingReservation.status.in_(
                OPEN_RESERVATION_STATUSES
            )
        )
        .first()
    )

    if open_reservation:
        raise HTTPException(
            status_code=400,
            detail="User already has an active reservation",
        )

    available_spaces = calculate_available_spaces(
        db,
        parking_zone.id,
        reservation_data.vehicle_type,
        current_user.role,
        requested_at=requested_arrival_at,
    )

    if available_spaces <= 0:
        raise HTTPException(
            status_code=400,
            detail="No parking space available",
        )

    arrival_deadline = (
        requested_arrival_at
        + timedelta(
            minutes=RESERVATION_GRACE_PERIOD_MINUTES
        )
    )

    reservation = ParkingReservation(
        user_id=current_user.id,
        parking_zone_id=parking_zone.id,
        vehicle_type=reservation_data.vehicle_type,
        status="RESERVED",
        reserved_at=now,
        requested_arrival_at=requested_arrival_at,
        arrival_deadline=arrival_deadline,
    )

    db.add(reservation)
    db.flush()
    create_notification(
        db,
        user_id=current_user.id,
        notification_type="RESERVATION_CONFIRMED",
        title="Parking reservation confirmed",
        message=f"Your {reservation.vehicle_type.lower().replace('_', ' ')} parking reservation at {parking_zone.name} is confirmed.",
        related_id=reservation.id,
        commit=False,
    )
    db.commit()
    db.refresh(reservation)

    return reservation


def cancel_reservation(
    db: Session,
    reservation_id: int,
    current_user: User,
) -> ParkingReservation:

    reservation = get_reservation_or_404(
        db,
        reservation_id,
    )

    if reservation.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not own this reservation",
        )

    if reservation.status != "RESERVED":
        raise HTTPException(
            status_code=400,
            detail="Reservation cannot be cancelled",
        )

    reservation.status = "CANCELLED"
    reservation.cancelled_at = _utc_now()

    parking_zone = get_parking_zone_or_404(db, reservation.parking_zone_id)
    create_notification(
        db,
        user_id=current_user.id,
        notification_type="RESERVATION_CANCELLED",
        title="Parking reservation cancelled",
        message=f"Your parking reservation at {parking_zone.name} was cancelled.",
        related_id=reservation.id,
        commit=False,
    )
    db.commit()
    db.refresh(reservation)

    return reservation


def check_in_reservation(
    db: Session,
    reservation_id: int,
    current_user: User,
) -> ParkingReservation:

    reservation = get_reservation_or_404(
        db,
        reservation_id,
    )

    if reservation.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not own this reservation",
        )

    if reservation.status != "RESERVED":
        raise HTTPException(
            status_code=400,
            detail="Reservation is not reserved",
        )

    now = _utc_now()

    if now > _ensure_utc(reservation.arrival_deadline):
        raise HTTPException(
            status_code=400,
            detail="Reservation deadline has passed",
        )

    parking_zone = get_parking_zone_or_404(
        db,
        reservation.parking_zone_id,
    )
    reservation.status = "ACTIVE"
    reservation.checked_in_at = now

    create_notification(
        db,
        user_id=current_user.id,
        notification_type="PARKING_CHECKED_IN",
        title="Parking check-in successful",
        message=f"You checked in successfully at {parking_zone.name}.",
        related_id=reservation.id,
        commit=False,
    )
    db.commit()
    db.refresh(reservation)

    return reservation


def complete_reservation(
    db: Session,
    reservation_id: int,
    current_user: User,
) -> ParkingReservation:

    reservation = get_reservation_or_404(
        db,
        reservation_id,
    )

    if reservation.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not own this reservation",
        )

    if reservation.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Reservation is not active",
        )

    parking_zone = get_parking_zone_or_404(
        db,
        reservation.parking_zone_id,
    )
    reservation.status = "COMPLETED"
    reservation.completed_at = _utc_now()

    create_notification(
        db,
        user_id=current_user.id,
        notification_type="PARKING_COMPLETED",
        title="Parking session completed",
        message=f"Your parking session at {parking_zone.name} is complete.",
        related_id=reservation.id,
        commit=False,
    )
    db.commit()
    db.refresh(reservation)

    return reservation


def mark_expired_reservations_no_show(db: Session | None = None) -> int:
    session = db if db is not None else SessionLocal()
    updated_count = 0

    try:
        now = _utc_now()
        expired_reservations = (
            session.query(ParkingReservation)
            .filter(ParkingReservation.status == "RESERVED")
            .all()
        )

        for reservation in expired_reservations:
            if now > _ensure_utc(reservation.arrival_deadline):
                reservation.status = "NO_SHOW"
                reservation.no_show_at = now
                parking_zone = session.get(ParkingZone, reservation.parking_zone_id)
                zone_name = parking_zone.name if parking_zone else "your parking zone"
                create_notification(
                    session,
                    user_id=reservation.user_id,
                    notification_type="NO_SHOW_RELEASED",
                    title="Parking reservation expired",
                    message=f"Your reservation at {zone_name} expired without check-in and the space was released.",
                    related_id=reservation.id,
                    commit=False,
                )
                updated_count += 1

        session.commit()
        return updated_count

    except Exception:
        session.rollback()
        raise
    finally:
        if db is None:
            session.close()