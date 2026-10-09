from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.building import Building
from app.models.campus_node import CampusNode
from app.models.crowd_data import CrowdData
from app.models.facility import Facility
from app.models.gate import Gate


SUPPORTED_LOCATION_TYPES = {
    "BUILDING": Building,
    "FACILITY": Facility,
    "GATE": Gate,
    "CAMPUS_NODE": CampusNode,
    "NODE": CampusNode,
}


def classify_crowd(people_count: int, capacity: int | None) -> tuple[str, float | None]:
    if capacity is None or capacity <= 0:
        return "UNKNOWN", None

    people_count = max(int(people_count), 0)
    occupancy = (float(people_count) / float(capacity)) * 100
    if occupancy <= 40:
        crowd_level = "LOW"
    elif occupancy <= 70:
        crowd_level = "MEDIUM"
    else:
        crowd_level = "HIGH"

    return crowd_level, round(occupancy, 2)


def _normalize_location_type(location_type: str | None) -> str:
    if not location_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Location type is required",
        )

    normalized = location_type.strip().upper()
    if normalized.endswith("S") and normalized not in {"CAMPUS_NODE", "NODE"}:
        normalized = normalized[:-1]

    if normalized not in SUPPORTED_LOCATION_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported location type",
        )

    return normalized


def _location_model_for_type(location_type: str):
    return SUPPORTED_LOCATION_TYPES[_normalize_location_type(location_type)]


def _get_location_name(db: Session, location_type: str, location_id: int) -> str:
    model = _location_model_for_type(location_type)
    record = db.query(model).filter(model.id == location_id).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{location_type.title()} {location_id} not found",
        )

    if hasattr(record, "name"):
        return record.name
    if hasattr(record, "label"):
        return record.label
    return str(location_id)


def _seed_simulated_crowd_data(db: Session) -> None:
    if db.query(CrowdData).filter(CrowdData.source == "SIMULATED").first():
        return

    candidate_locations: list[tuple[str, int, int]] = []

    for model, loc_type in [
        (Building, "BUILDING"),
        (Facility, "FACILITY"),
        (Gate, "GATE"),
        (CampusNode, "CAMPUS_NODE"),
    ]:
        rows = db.query(model).order_by(model.id).all()
        for row in rows[:3]:
            name = getattr(row, "name", None) or getattr(row, "label", None)
            if not name:
                continue
            capacity = 120 if loc_type == "BUILDING" else 80 if loc_type == "FACILITY" else 60 if loc_type == "GATE" else 90
            candidate_locations.append((loc_type, int(row.id), capacity))

    for location_type, location_id, capacity in candidate_locations:
        people_count = min(max(int(capacity * 0.35), 12), capacity)
        crowd_level, occupancy = classify_crowd(people_count, capacity)
        db.add(
            CrowdData(
                location_type=location_type,
                location_id=location_id,
                people_count=people_count,
                capacity=capacity,
                crowd_level=crowd_level,
                source="SIMULATED",
                recorded_at=datetime.now(timezone.utc),
            )
        )

    db.commit()


def _build_crowd_response(db: Session, record: CrowdData) -> dict:
    location_name = _get_location_name(db, record.location_type, record.location_id)
    crowd_level, occupancy = classify_crowd(record.people_count, record.capacity)
    return {
        "location_type": record.location_type,
        "location_id": record.location_id,
        "location_name": location_name,
        "people_count": int(record.people_count),
        "capacity": int(record.capacity) if record.capacity is not None else None,
        "occupancy_percentage": occupancy,
        "crowd_level": crowd_level,
        "recorded_at": record.recorded_at,
        "source": record.source,
    }


def get_latest_crowd_records(db: Session, location_type: str | None = None, location_id: int | None = None):
    _seed_simulated_crowd_data(db)

    rows = db.query(CrowdData).order_by(CrowdData.recorded_at.desc()).all()
    latest_by_location: dict[tuple[str, int], CrowdData] = {}
    for row in rows:
        key = (row.location_type, row.location_id)
        latest_by_location.setdefault(key, row)

    filtered = list(latest_by_location.values())

    if location_type:
        normalized = _normalize_location_type(location_type)
        filtered = [row for row in filtered if row.location_type == normalized]

    if location_id is not None:
        filtered = [row for row in filtered if row.location_id == location_id]

    if not filtered:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No crowd data found for the requested location",
        )

    return [_build_crowd_response(db, row) for row in filtered]
