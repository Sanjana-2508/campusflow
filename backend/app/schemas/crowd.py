from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CrowdLocationResponse(BaseModel):
    location_type: str
    location_id: int
    location_name: str
    people_count: int
    capacity: int | None = None
    occupancy_percentage: float | None = None
    crowd_level: str
    recorded_at: datetime
    source: str

    model_config = ConfigDict(from_attributes=True)
