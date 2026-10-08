from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.facility import FacilityCreate, FacilityResponse, FacilityUpdate
from app.services.campus import (
    create_facility,
    delete_facility,
    get_facility_or_404,
    list_facilities,
    update_facility,
)

router = APIRouter(prefix="/facilities", tags=["Facilities"])


@router.get("", response_model=list[FacilityResponse])
def get_facilities(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_facilities(db)


@router.get("/{facility_id}", response_model=FacilityResponse)
def get_facility(
    facility_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_facility_or_404(db, facility_id)


@router.post("", response_model=FacilityResponse, status_code=201)
def create_facility_route(
    request: FacilityCreate,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return create_facility(db, request)


@router.put("/{facility_id}", response_model=FacilityResponse)
def update_facility_route(
    facility_id: int,
    request: FacilityUpdate,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return update_facility(db, facility_id, request)


@router.delete("/{facility_id}")
def delete_facility_route(
    facility_id: int,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    delete_facility(db, facility_id)
    return {"message": "Facility deleted successfully"}
