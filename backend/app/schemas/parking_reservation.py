from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ParkingReservationCreate(BaseModel):
    parking_zone_id: int
    vehicle_type: str = Field(..., pattern="^(CAR|TWO_WHEELER)$")
    requested_arrival_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ParkingReservationResponse(BaseModel):
    id: int
    user_id: int
    parking_zone_id: int
    vehicle_type: str
    status: str
    reserved_at: datetime | None = None
    requested_arrival_at: datetime | None = None
    arrival_deadline: datetime | None = None
    checked_in_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    no_show_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
