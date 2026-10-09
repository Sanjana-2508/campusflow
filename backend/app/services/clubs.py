from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.club import Club
from app.models.user import User
from app.schemas.club import ClubCreate, ClubUpdate


def _get_club_or_404(db: Session, club_id: int) -> Club:
    club = db.query(Club).filter(Club.id == club_id).first()
    if club is None:
        raise HTTPException(status_code=404, detail="Club not found")
    return club


def _serialize_club(db: Session, club: Club) -> dict:
    owner = db.get(User, club.owner_user_id)
    return {
        "id": club.id,
        "name": club.name,
        "description": club.description,
        "owner_user_id": club.owner_user_id,
        "owner_name": owner.name if owner else "Unknown",
        "verification_status": club.verification_status,
    }


def list_clubs(
    db: Session,
    *,
    search: str | None = None,
    verification_status: str | None = None,
) -> list[dict]:
    query = db.query(Club)
    if verification_status:
        query = query.filter(Club.verification_status == verification_status)
    else:
        query = query.filter(Club.verification_status == "APPROVED")
    if search:
        query = query.filter(Club.name.ilike(f"%{search.strip()}%"))
    clubs = query.order_by(Club.name, Club.id).all()
    return [_serialize_club(db, club) for club in clubs]


def get_club(db: Session, club_id: int, current_user: User) -> dict:
    club = _get_club_or_404(db, club_id)
    if (
        club.verification_status != "APPROVED"
        and club.owner_user_id != current_user.id
        and current_user.role != "ADMIN"
    ):
        raise HTTPException(status_code=404, detail="Club not found")
    return _serialize_club(db, club)


def create_club(db: Session, current_user: User, request: ClubCreate) -> dict:
    club = Club(
        name=request.name.strip(),
        description=request.description,
        owner_user_id=current_user.id,
        verification_status="PENDING",
    )
    db.add(club)
    db.commit()
    db.refresh(club)
    return _serialize_club(db, club)


def update_club(
    db: Session,
    club_id: int,
    current_user: User,
    request: ClubUpdate,
) -> dict:
    club = _get_club_or_404(db, club_id)
    if club.owner_user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="You cannot manage this club")
    club.name = request.name.strip()
    club.description = request.description
    db.commit()
    db.refresh(club)
    return _serialize_club(db, club)


def update_club_verification(
    db: Session,
    club_id: int,
    verification_status: str,
) -> dict:
    club = _get_club_or_404(db, club_id)
    club.verification_status = verification_status
    db.commit()
    db.refresh(club)
    return _serialize_club(db, club)
