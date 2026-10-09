from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.campus_node import CampusNode
from app.models.crowd_data import CrowdData
from app.models.parking_zone import ParkingZone
from app.services.navigation import find_shortest_route
from app.services.parking import calculate_available_spaces

WALKING_SPEED_METERS_PER_MINUTE = 75
MAX_WALKING_MINUTES = 15
SCORING_WEIGHTS = {
    "availability": 0.4,
    "distance": 0.3,
    "crowd_level": 0.3,
}
_CROWD_SCORES = {
    "LOW": 1.0,
    "MEDIUM": 0.5,
    "HIGH": 0.0,
}


def _haversine_distance_meters(
    lat_a: float,
    lng_a: float,
    lat_b: float,
    lng_b: float,
) -> float:
    earth_radius_meters = 6_371_000
    lat_a_rad, lat_b_rad = math.radians(lat_a), math.radians(lat_b)
    delta_lat = math.radians(lat_b - lat_a)
    delta_lng = math.radians(lng_b - lng_a)
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat_a_rad)
        * math.cos(lat_b_rad)
        * math.sin(delta_lng / 2) ** 2
    )
    return 2 * earth_radius_meters * math.asin(math.sqrt(haversine))


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _get_crowd_records(db: Session) -> dict[tuple[str, int], CrowdData]:
    records = (
        db.query(CrowdData)
        .order_by(CrowdData.recorded_at.desc())
        .all()
    )
    latest: dict[tuple[str, int], CrowdData] = {}
    for record in records:
        key = (record.location_type.upper(), record.location_id)
        latest.setdefault(key, record)
    return latest


def _crowd_for_zone(
    crowd_records: dict[tuple[str, int], CrowdData],
    zone_id: int,
    nearest_node_id: int,
) -> CrowdData | None:
    return (
        crowd_records.get(("PARKING_ZONE", zone_id))
        or crowd_records.get(("CAMPUS_NODE", nearest_node_id))
        or crowd_records.get(("NODE", nearest_node_id))
    )


def recommend_parking_zones(
    db: Session,
    *,
    source_node_id: int,
    vehicle_type: str,
    user_role: str,
    requested_at: datetime | None = None,
) -> dict[str, Any]:
    normalized_vehicle_type = vehicle_type.strip().upper()
    if normalized_vehicle_type not in {"CAR", "TWO_WHEELER"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid vehicle type",
        )

    source_node = db.get(CampusNode, source_node_id)
    if source_node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source campus node not found",
        )

    nodes = db.query(CampusNode).all()
    if not nodes:
        return {
            "source_node_id": source_node_id,
            "vehicle_type": normalized_vehicle_type,
            "recommendations": [],
        }

    zones = db.query(ParkingZone).all()
    open_zones = [zone for zone in zones if zone.status == "OPEN"]
    crowd_records = _get_crowd_records(db)

    route_cache: dict[int, float | None] = {}
    recommendations: list[dict[str, Any]] = []
    now = _utc(requested_at) if requested_at else datetime.now(timezone.utc)

    for zone in open_zones:
        available = calculate_available_spaces(
            db,
            zone.id,
            normalized_vehicle_type,
            user_role,
            requested_at=now,
        )
        if available <= 0:
            continue

        capacity_field = (
            "car_capacity"
            if normalized_vehicle_type == "CAR"
            else "bike_capacity"
        )
        reserved_field = (
            "staff_reserved_car"
            if normalized_vehicle_type == "CAR"
            else "staff_reserved_bike"
        )
        total_capacity = int(getattr(zone, capacity_field))
        usable_capacity = (
            max(total_capacity - int(getattr(zone, reserved_field)), 0)
            if user_role == "STUDENT"
            else max(total_capacity, 0)
        )
        if usable_capacity == 0:
            continue

        nearest_node = min(
            nodes,
            key=lambda node: _haversine_distance_meters(
                float(node.lat),
                float(node.lng),
                float(zone.lat),
                float(zone.lng),
            ),
        )

        if nearest_node.id not in route_cache:
            try:
                route = find_shortest_route(
                    db,
                    source_node_id,
                    nearest_node.id,
                )
                route_cache[nearest_node.id] = route["total_distance_meters"]
            except HTTPException as exc:
                if exc.status_code != status.HTTP_404_NOT_FOUND:
                    raise
                route_cache[nearest_node.id] = None

        route_distance = route_cache[nearest_node.id]
        if route_distance is None:
            continue

        connector_distance = _haversine_distance_meters(
            float(nearest_node.lat),
            float(nearest_node.lng),
            float(zone.lat),
            float(zone.lng),
        )
        distance_meters = route_distance + connector_distance
        walking_minutes = distance_meters / WALKING_SPEED_METERS_PER_MINUTE
        if walking_minutes > MAX_WALKING_MINUTES:
            continue

        crowd_record = _crowd_for_zone(
            crowd_records,
            zone.id,
            nearest_node.id,
        )
        crowd_level = crowd_record.crowd_level if crowd_record else None
        crowd_score = (
            _CROWD_SCORES.get(crowd_level, 0.5)
            if crowd_level
            else 0.5
        )
        availability_score = min(available / usable_capacity, 1.0)
        distance_score = 1.0 - (walking_minutes / MAX_WALKING_MINUTES)
        score = (
            SCORING_WEIGHTS["availability"] * availability_score
            + SCORING_WEIGHTS["distance"] * distance_score
            + SCORING_WEIGHTS["crowd_level"] * crowd_score
        )

        recommendations.append(
            {
                "location_id": zone.id,
                "name": zone.name,
                "status": zone.status,
                "vehicle_type": normalized_vehicle_type,
                "available_spaces": available,
                "capacity": usable_capacity,
                "estimated_distance_meters": round(distance_meters, 2),
                "estimated_walking_time_minutes": round(walking_minutes, 2),
                "crowd_level": crowd_level,
                "crowd_recorded_at": crowd_record.recorded_at if crowd_record else None,
                "score": round(score, 4),
            }
        )

    recommendations.sort(
        key=lambda item: (-item["score"], item["location_id"])
    )
    return {
        "source_node_id": source_node_id,
        "vehicle_type": normalized_vehicle_type,
        "recommendations": recommendations,
    }
