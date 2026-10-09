from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.lost_found import (
    LostFoundCreate,
    LostFoundResponse,
    LostFoundStatusUpdate,
    LostFoundUpdate,
)
from app.services.lost_found import (
    create_item,
    get_item,
    list_items,
    update_item,
    update_item_status,
)

router = APIRouter(prefix="/lost-found", tags=["Lost & Found"])


@router.post("", response_model=LostFoundResponse, status_code=201)
def create_lost_found_item(
    request: LostFoundCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_item(db, current_user, request)


@router.get("", response_model=list[LostFoundResponse])
def get_lost_found_items(
    item_type: Literal["LOST", "FOUND"] | None = None,
    status: Literal["OPEN", "RESOLVED", "REMOVED"] | None = None,
    search: str | None = Query(default=None, max_length=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if status == "REMOVED" and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only administrators can view removed reports")
    return list_items(
        db,
        item_type=item_type,
        status=status,
        search=search,
        include_removed=current_user.role == "ADMIN",
    )


@router.get("/{item_id}", response_model=LostFoundResponse)
def get_lost_found_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = get_item(db, item_id)
    if item["status"] == "REMOVED" and current_user.role != "ADMIN":
        raise HTTPException(status_code=404, detail="Lost & Found item not found")
    return item


@router.put("/{item_id}", response_model=LostFoundResponse)
def update_lost_found_item(
    item_id: int,
    request: LostFoundUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_item(db, item_id, current_user, request)


@router.patch("/{item_id}/status", response_model=LostFoundResponse)
def change_lost_found_status(
    item_id: int,
    request: LostFoundStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_item_status(db, item_id, current_user, request.status)
