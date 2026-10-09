from datetime import date, time

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.building import Building
from app.models.club import Club
from app.models.event import Event
from app.models.event_bookmark import EventBookmark
from app.models.user import User
from app.schemas.event import EventCreate, EventUpdate


def _get_event_or_404(db: Session, event_id: int) -> Event:
    event = db.query(Event).filter(Event.id == event_id).first()
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def _serialize_event(db: Session, event: Event) -> dict:
    organizer = db.get(User, event.organizer_user_id)
    club = db.get(Club, event.club_id) if event.club_id is not None else None
    return {
        "id": event.id,
        "title": event.title,
        "description": event.description,
        "organizer_user_id": event.organizer_user_id,
        "organizer_name": organizer.name if organizer else "Unknown",
        "club_id": event.club_id,
        "club_name": club.name if club else None,
        "venue": event.venue,
        "venue_building_id": event.venue_building_id,
        "event_date": event.event_date,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "poster": event.poster,
        "registration_url": event.registration_url,
        "qr_code": event.qr_code,
        "expected_attendance": event.expected_attendance,
        "status": event.status,
    }


def _validate_event_times(event_date: date, start_time: time, end_time: time) -> None:
    if end_time <= start_time:
        raise HTTPException(
            status_code=422,
            detail="Event end time must be later than its start time",
        )


def _authorize_event_creation(
    db: Session,
    current_user: User,
    club_id: int | None,
) -> None:
    if club_id is None:
        if current_user.role not in {"FACULTY_STAFF", "ADMIN"}:
            raise HTTPException(
                status_code=403,
                detail="Students must organize events through an approved club",
            )
        return

    club = (
        db.query(Club)
        .filter(Club.id == club_id)
        .with_for_update()
        .first()
    )
    if club is None:
        raise HTTPException(status_code=404, detail="Club not found")
    if current_user.role == "ADMIN":
        return
    if club.verification_status != "APPROVED":
        raise HTTPException(status_code=403, detail="Club is not approved")
    if club.owner_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not organize this club")


def _authorize_event_update(
    db: Session,
    event: Event,
    current_user: User,
) -> None:
    if current_user.role == "ADMIN":
        return
    if event.club_id is None:
        if (
            current_user.role != "FACULTY_STAFF"
            or event.organizer_user_id != current_user.id
        ):
            raise HTTPException(status_code=403, detail="You cannot manage this event")
        return

    club = (
        db.query(Club)
        .filter(Club.id == event.club_id)
        .with_for_update()
        .first()
    )
    if (
        club is None
        or club.verification_status != "APPROVED"
        or club.owner_user_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="You cannot manage this event")


def _authorize_event_transfer(
    db: Session,
    current_user: User,
    new_club_id: int | None,
) -> None:
    if new_club_id is None:
        if current_user.role not in {"FACULTY_STAFF", "ADMIN"}:
            raise HTTPException(
                status_code=403,
                detail="Only faculty/staff or administrators can move events outside a club",
            )
        return

    club = (
        db.query(Club)
        .filter(Club.id == new_club_id)
        .with_for_update()
        .first()
    )
    if club is None:
        raise HTTPException(status_code=404, detail="Club not found")
    if current_user.role == "ADMIN":
        return
    if club.verification_status != "APPROVED":
        raise HTTPException(status_code=403, detail="Club is not approved")
    if club.owner_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not organize this club")


def _authorize_event_publication(
    db: Session,
    event: Event,
    current_user: User,
) -> None:
    if event.club_id is not None:
        club = (
            db.query(Club)
            .filter(Club.id == event.club_id)
            .with_for_update()
            .first()
        )
        if club is None or club.verification_status != "APPROVED":
            raise HTTPException(
                status_code=403,
                detail="Events can only be published for approved clubs",
            )
        if current_user.role != "ADMIN" and club.owner_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="You do not organize this club")
        return
    if current_user.role == "ADMIN":
        return
    if (
        current_user.role != "FACULTY_STAFF"
        or event.organizer_user_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="You cannot publish this event")


def _validate_building(db: Session, building_id: int | None) -> None:
    if building_id is not None and db.get(Building, building_id) is None:
        raise HTTPException(status_code=404, detail="Venue building not found")


def _event_is_visible(event: Event, current_user: User) -> bool:
    return (
        event.status == "PUBLISHED"
        or event.organizer_user_id == current_user.id
        or current_user.role == "ADMIN"
    )


def list_events(
    db: Session,
    current_user: User,
    *,
    club_id: int | None = None,
    event_date: date | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    status: str | None = None,
) -> list[dict]:
    query = db.query(Event)
    if current_user.role != "ADMIN":
        query = query.filter(
            (Event.status == "PUBLISHED")
            | (Event.organizer_user_id == current_user.id)
        )
    if club_id is not None:
        query = query.filter(Event.club_id == club_id)
    if event_date is not None:
        query = query.filter(Event.event_date == event_date)
    if from_date is not None:
        query = query.filter(Event.event_date >= from_date)
    if to_date is not None:
        query = query.filter(Event.event_date <= to_date)
    if status is not None:
        query = query.filter(Event.status == status)
    return [
        _serialize_event(db, event)
        for event in query.order_by(Event.event_date, Event.start_time, Event.id).all()
    ]


def get_event(db: Session, event_id: int, current_user: User) -> dict:
    event = _get_event_or_404(db, event_id)
    if not _event_is_visible(event, current_user):
        raise HTTPException(status_code=404, detail="Event not found")
    return _serialize_event(db, event)


def create_event(db: Session, current_user: User, request: EventCreate) -> dict:
    _validate_event_times(request.event_date, request.start_time, request.end_time)
    _authorize_event_creation(db, current_user, request.club_id)
    _validate_building(db, request.venue_building_id)
    event = Event(
        title=request.title.strip(),
        description=request.description,
        organizer_user_id=current_user.id,
        club_id=request.club_id,
        venue=request.venue,
        venue_building_id=request.venue_building_id,
        event_date=request.event_date,
        start_time=request.start_time,
        end_time=request.end_time,
        poster=request.poster,
        registration_url=request.registration_url,
        qr_code=request.qr_code,
        expected_attendance=request.expected_attendance,
        status="DRAFT",
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _serialize_event(db, event)


def update_event(
    db: Session,
    event_id: int,
    current_user: User,
    request: EventUpdate,
) -> dict:
    event = _get_event_or_404(db, event_id)
    _authorize_event_update(db, event, current_user)
    if event.status in {"CANCELLED", "REMOVED"}:
        raise HTTPException(status_code=400, detail="Closed events cannot be edited")
    _validate_event_times(request.event_date, request.start_time, request.end_time)
    if request.club_id != event.club_id:
        _authorize_event_transfer(db, current_user, request.club_id)
    _validate_building(db, request.venue_building_id)
    for field, value in request.model_dump().items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return _serialize_event(db, event)


def cancel_event(db: Session, event_id: int, current_user: User) -> dict:
    event = _get_event_or_404(db, event_id)
    _authorize_event_update(db, event, current_user)
    if event.status in {"CANCELLED", "REMOVED"}:
        raise HTTPException(status_code=400, detail="Event is already closed")
    event.status = "CANCELLED"
    db.commit()
    db.refresh(event)
    return _serialize_event(db, event)


def update_event_status(
    db: Session,
    event_id: int,
    current_user: User,
    new_status: str,
) -> dict:
    event = _get_event_or_404(db, event_id)
    _authorize_event_update(db, event, current_user)
    if event.status in {"CANCELLED", "REMOVED"}:
        raise HTTPException(status_code=400, detail="Closed events cannot change status")
    if new_status == event.status:
        return _serialize_event(db, event)
    if event.status != "DRAFT" or new_status != "PUBLISHED":
        raise HTTPException(
            status_code=400,
            detail="Events may only transition from DRAFT to PUBLISHED",
        )
    _authorize_event_publication(db, event, current_user)
    event.status = new_status
    db.commit()
    db.refresh(event)
    return _serialize_event(db, event)


def bookmark_event(db: Session, event_id: int, current_user: User) -> EventBookmark:
    event = _get_event_or_404(db, event_id)
    if event.status != "PUBLISHED":
        raise HTTPException(status_code=404, detail="Event not found")
    bookmark = (
        db.query(EventBookmark)
        .filter(
            EventBookmark.user_id == current_user.id,
            EventBookmark.event_id == event_id,
        )
        .first()
    )
    if bookmark:
        return bookmark
    bookmark = EventBookmark(user_id=current_user.id, event_id=event_id)
    db.add(bookmark)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        bookmark = (
            db.query(EventBookmark)
            .filter(
                EventBookmark.user_id == current_user.id,
                EventBookmark.event_id == event_id,
            )
            .first()
        )
        if bookmark is None:
            raise
        return bookmark
    db.refresh(bookmark)
    return bookmark


def remove_event_bookmark(db: Session, event_id: int, user_id: int) -> None:
    bookmark = (
        db.query(EventBookmark)
        .filter(
            EventBookmark.user_id == user_id,
            EventBookmark.event_id == event_id,
        )
        .first()
    )
    if bookmark is None:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    db.delete(bookmark)
    db.commit()


def list_bookmarked_events(db: Session, user_id: int) -> list[dict]:
    """Return only published events; bookmarks persist while an event is hidden."""
    rows = (
        db.query(EventBookmark, Event)
        .join(Event, Event.id == EventBookmark.event_id)
        .filter(
            EventBookmark.user_id == user_id,
            Event.status == "PUBLISHED",
        )
        .order_by(EventBookmark.id.desc())
        .all()
    )
    return [_serialize_event(db, event) for _, event in rows]
