from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.gate import GateCreate, GateResponse, GateUpdate
from app.services.campus import (
    create_gate,
    delete_gate,
    get_gate_or_404,
    list_gates,
    update_gate,
)

router = APIRouter(prefix="/gates", tags=["Gates"])


@router.get("", response_model=list[GateResponse])
def get_gates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_gates(db)


@router.get("/{gate_id}", response_model=GateResponse)
def get_gate(
    gate_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_gate_or_404(db, gate_id)


@router.post("", response_model=GateResponse, status_code=201)
def create_gate_route(
    request: GateCreate,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return create_gate(db, request)


@router.put("/{gate_id}", response_model=GateResponse)
def update_gate_route(
    gate_id: int,
    request: GateUpdate,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    return update_gate(db, gate_id, request)


@router.delete("/{gate_id}")
def delete_gate_route(
    gate_id: int,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    delete_gate(db, gate_id)
    return {"message": "Gate deleted successfully"}
