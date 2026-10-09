from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.event import (
    EventBookmarkResponse,
    EventCreate,
    EventResponse,
    EventStatusUpdate,
    EventUpdate,
)
from app.services.events import (
    bookmark_event,
    cancel_event,
    create_event,
    get_event,
    list_bookmarked_events,
    list_events,
    remove_event_bookmark,
    update_event,
    update_event_status,
)

router = APIRouter(prefix="/events", tags=["Events"])


@router.get("/bookmarks/me", response_model=list[EventResponse])
def get_my_event_bookmarks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_bookmarked_events(db, current_user.id)


@router.get("", response_model=list[EventResponse])
def get_events(
    club_id: int | None = Query(default=None, gt=0),
    event_date: date | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    status: Literal["DRAFT", "PUBLISHED", "CANCELLED", "REMOVED"] | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="from_date must be on or before to_date")
    if status in {"CANCELLED", "REMOVED"} and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only administrators can filter closed events")
    return list_events(
        db,
        current_user,
        club_id=club_id,
        event_date=event_date,
        from_date=from_date,
        to_date=to_date,
        status=status,
    )


@router.post("", response_model=EventResponse, status_code=201)
def create_event_route(
    request: EventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_event(db, current_user, request)


@router.get("/{event_id}", response_model=EventResponse)
def get_event_by_id(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_event(db, event_id, current_user)


@router.put("/{event_id}", response_model=EventResponse)
def update_event_route(
    event_id: int,
    request: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_event(db, event_id, current_user, request)


@router.patch("/{event_id}/status", response_model=EventResponse)
def update_event_status_route(
    event_id: int,
    request: EventStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_event_status(db, event_id, current_user, request.status)


@router.patch("/{event_id}/cancel", response_model=EventResponse)
def cancel_event_route(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return cancel_event(db, event_id, current_user)


@router.post(
    "/{event_id}/bookmark",
    response_model=EventBookmarkResponse,
    status_code=201,
)
def add_event_bookmark(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return bookmark_event(db, event_id, current_user)


@router.delete("/{event_id}/bookmark", status_code=204)
def delete_event_bookmark(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    remove_event_bookmark(db, event_id, current_user.id)
    return Response(status_code=204)
