from datetime import datetime

from pydantic import BaseModel


class ParkingRecommendation(BaseModel):
    location_id: int
    name: str
    status: str
    vehicle_type: str
    available_spaces: int
    capacity: int
    estimated_distance_meters: float
    estimated_walking_time_minutes: float
    crowd_level: str | None = None
    crowd_recorded_at: datetime | None = None
    score: float


class ParkingRecommendationsResponse(BaseModel):
    source_node_id: int
    vehicle_type: str
    recommendations: list[ParkingRecommendation]
