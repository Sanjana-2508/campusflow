from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.crowd import CrowdLocationResponse
from app.services.crowd import get_latest_crowd_records

router = APIRouter(prefix="/crowd", tags=["Crowd"])


@router.get("", response_model=list[CrowdLocationResponse])
def get_all_crowd_levels(
    location_type: str | None = Query(default=None, description="Optional: BUILDING, FACILITY, GATE, CAMPUS_NODE"),
    location_id: int | None = Query(default=None, description="Optional location id filter"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_latest_crowd_records(db, location_type=location_type, location_id=location_id)


@router.get("/{location_type}/{location_id}", response_model=CrowdLocationResponse)
def get_single_crowd_level(
    location_type: str = Path(..., description="BUILDING, FACILITY, GATE, CAMPUS_NODE"),
    location_id: int = Path(..., description="Location id"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    records = get_latest_crowd_records(db, location_type=location_type, location_id=location_id)
    if not records:
        raise HTTPException(status_code=404, detail="No crowd data found for the requested location")
    return records[0]
