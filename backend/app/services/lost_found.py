from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.lost_found import LostFound
from app.models.user import User
from app.schemas.lost_found import LostFoundCreate, LostFoundUpdate


def _get_item_or_404(db: Session, item_id: int) -> LostFound:
    item = db.query(LostFound).filter(LostFound.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Lost & Found item not found")
    return item


def _serialize_item(db: Session, item: LostFound) -> dict:
    reporter = db.get(User, item.user_id)
    return {
        "id": item.id,
        "user_id": item.user_id,
        "reporter_name": reporter.name if reporter else "Unknown",
        "type": item.type,
        "item_name": item.item_name,
        "description": item.description,
        "location": item.location,
        "item_date": item.item_date,
        "image": item.image,
        "contact": item.contact,
        "status": item.status,
        "created_at": item.created_at,
    }


def create_item(db: Session, current_user: User, request: LostFoundCreate) -> dict:
    item = LostFound(
        user_id=current_user.id,
        type=request.type,
        item_name=request.item_name.strip(),
        description=request.description,
        location=request.location,
        item_date=request.item_date,
        image=request.image,
        contact=request.contact,
        status="OPEN",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_item(db, item)


def list_items(
    db: Session,
    *,
    item_type: str | None = None,
    status: str | None = None,
    search: str | None = None,
    include_removed: bool = False,
) -> list[dict]:
    query = db.query(LostFound)
    if not include_removed:
        query = query.filter(LostFound.status != "REMOVED")
    if item_type:
        query = query.filter(LostFound.type == item_type)
    if status:
        query = query.filter(LostFound.status == status)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            LostFound.item_name.ilike(pattern)
            | LostFound.description.ilike(pattern)
            | LostFound.location.ilike(pattern)
        )
    items = query.order_by(LostFound.created_at.desc(), LostFound.id.desc()).all()
    return [_serialize_item(db, item) for item in items]


def get_item(db: Session, item_id: int) -> dict:
    return _serialize_item(db, _get_item_or_404(db, item_id))


def update_item(
    db: Session,
    item_id: int,
    current_user: User,
    request: LostFoundUpdate,
) -> dict:
    item = _get_item_or_404(db, item_id)
    if item.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="You cannot edit this report")
    if item.status in {"RESOLVED", "REMOVED"} and current_user.role != "ADMIN":
        raise HTTPException(status_code=400, detail="Closed reports cannot be edited")

    for field, value in request.model_dump(exclude_unset=True).items():
        if field == "item_name" and value is not None:
            value = value.strip()
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return _serialize_item(db, item)


def update_item_status(
    db: Session,
    item_id: int,
    current_user: User,
    new_status: str,
) -> dict:
    item = _get_item_or_404(db, item_id)
    is_admin = current_user.role == "ADMIN"
    if item.user_id != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="You cannot update this report")
    if new_status == "REMOVED" and not is_admin:
        raise HTTPException(status_code=403, detail="Only administrators can remove reports")
    if item.status == new_status:
        return _serialize_item(db, item)
    allowed_transitions = {
        "OPEN": {"RESOLVED", "REMOVED"} if is_admin else {"RESOLVED"},
        "RESOLVED": {"REMOVED"} if is_admin else set(),
        "REMOVED": set(),
    }
    if new_status not in allowed_transitions[item.status]:
        raise HTTPException(status_code=400, detail="Invalid report status transition")

    item.status = new_status
    db.commit()
    db.refresh(item)
    return _serialize_item(db, item)
