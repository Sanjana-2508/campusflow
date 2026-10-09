from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.building import BuildingCreate, BuildingResponse, BuildingUpdate
from app.services.campus import (
    create_building,
    delete_building,
    get_building_or_404,
    list_buildings,
    update_building,
)

router = APIRouter(prefix="/buildings", tags=["Buildings"])


@router.get("", response_model=list[BuildingResponse])
def get_buildings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_buildings(db)


@router.get("/{building_id}", response_model=BuildingResponse)
def get_building(
    building_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_building_or_404(db, building_id)


@router.post("", response_model=BuildingResponse, status_code=201)
def create_building_route(
    request: BuildingCreate,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return create_building(db, request)


@router.put("/{building_id}", response_model=BuildingResponse)
def update_building_route(
    building_id: int,
    request: BuildingUpdate,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return update_building(db, building_id, request)


@router.delete("/{building_id}")
def delete_building_route(
    building_id: int,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    delete_building(db, building_id)
    return {"message": "Building deleted successfully"}
