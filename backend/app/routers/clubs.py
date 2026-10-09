from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.club import (
    ClubCreate,
    ClubResponse,
    ClubUpdate,
    ClubVerificationUpdate,
)
from app.services.clubs import (
    create_club,
    get_club,
    list_clubs,
    update_club,
    update_club_verification,
)

router = APIRouter(prefix="/clubs", tags=["Clubs"])


@router.get("", response_model=list[ClubResponse])
def get_clubs(
    search: str | None = Query(default=None, max_length=100),
    verification_status: Literal["PENDING", "APPROVED", "REJECTED"] | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if verification_status in {"PENDING", "REJECTED"} and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only administrators can view unapproved clubs")
    return list_clubs(
        db,
        search=search,
        verification_status=verification_status,
    )


@router.get("/{club_id}", response_model=ClubResponse)
def get_club_by_id(
    club_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_club(db, club_id, current_user)


@router.post("", response_model=ClubResponse, status_code=201)
def create_club_route(
    request: ClubCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_club(db, current_user, request)


@router.put("/{club_id}", response_model=ClubResponse)
def update_club_route(
    club_id: int,
    request: ClubUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_club(db, club_id, current_user, request)


@router.patch("/{club_id}/verification", response_model=ClubResponse)
def set_club_verification(
    club_id: int,
    request: ClubVerificationUpdate,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return update_club_verification(
        db,
        club_id,
        request.verification_status,
    )
