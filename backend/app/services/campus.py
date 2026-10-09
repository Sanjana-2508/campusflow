from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.building import Building
from app.models.facility import Facility
from app.models.gate import Gate
from app.schemas.building import BuildingCreate, BuildingUpdate
from app.schemas.facility import FacilityCreate, FacilityUpdate
from app.schemas.gate import GateCreate, GateUpdate


def _to_decimal(value: float) -> Decimal:
    return Decimal(str(value))


def get_building_or_404(db: Session, building_id: int) -> Building:
    building = db.query(Building).filter(Building.id == building_id).first()
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
    return building


def list_buildings(db: Session):
    return db.query(Building).all()


def create_building(db: Session, building_data: BuildingCreate) -> Building:
    building = Building(
        name=building_data.name,
        type=building_data.type,
        lat=_to_decimal(building_data.lat),
        lng=_to_decimal(building_data.lng),
        description=building_data.description,
    )
    db.add(building)
    db.commit()
    db.refresh(building)
    return building


def update_building(db: Session, building_id: int, building_data: BuildingUpdate) -> Building:
    building = get_building_or_404(db, building_id)
    building.name = building_data.name
    building.type = building_data.type
    building.lat = _to_decimal(building_data.lat)
    building.lng = _to_decimal(building_data.lng)
    building.description = building_data.description
    db.commit()
    db.refresh(building)
    return building


def delete_building(db: Session, building_id: int) -> None:
    building = get_building_or_404(db, building_id)
    db.delete(building)
    db.commit()


def get_facility_or_404(db: Session, facility_id: int) -> Facility:
    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    return facility


def list_facilities(db: Session):
    return db.query(Facility).all()


def create_facility(db: Session, facility_data: FacilityCreate) -> Facility:
    facility = Facility(
        building_id=facility_data.building_id,
        name=facility_data.name,
        category=facility_data.category,
        lat=_to_decimal(facility_data.lat),
        lng=_to_decimal(facility_data.lng),
        description=facility_data.description,
    )
    db.add(facility)
    db.commit()
    db.refresh(facility)
    return facility


def update_facility(db: Session, facility_id: int, facility_data: FacilityUpdate) -> Facility:
    facility = get_facility_or_404(db, facility_id)
    facility.building_id = facility_data.building_id
    facility.name = facility_data.name
    facility.category = facility_data.category
    facility.lat = _to_decimal(facility_data.lat)
    facility.lng = _to_decimal(facility_data.lng)
    facility.description = facility_data.description
    db.commit()
    db.refresh(facility)
    return facility


def delete_facility(db: Session, facility_id: int) -> None:
    facility = get_facility_or_404(db, facility_id)
    db.delete(facility)
    db.commit()


def get_gate_or_404(db: Session, gate_id: int) -> Gate:
    gate = db.query(Gate).filter(Gate.id == gate_id).first()
    if not gate:
        raise HTTPException(status_code=404, detail="Gate not found")
    return gate


def list_gates(db: Session):
    return db.query(Gate).all()


def create_gate(db: Session, gate_data: GateCreate) -> Gate:
    gate = Gate(
        name=gate_data.name,
        lat=_to_decimal(gate_data.lat),
        lng=_to_decimal(gate_data.lng),
        description=gate_data.description,
    )
    db.add(gate)
    db.commit()
    db.refresh(gate)
    return gate


def update_gate(db: Session, gate_id: int, gate_data: GateUpdate) -> Gate:
    gate = get_gate_or_404(db, gate_id)
    gate.name = gate_data.name
    gate.lat = _to_decimal(gate_data.lat)
    gate.lng = _to_decimal(gate_data.lng)
    gate.description = gate_data.description
    db.commit()
    db.refresh(gate)
    return gate


def delete_gate(db: Session, gate_id: int) -> None:
    gate = get_gate_or_404(db, gate_id)
    db.delete(gate)
    db.commit()
