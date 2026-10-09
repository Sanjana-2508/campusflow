from pydantic import BaseModel, ConfigDict


class ParkingZoneBase(BaseModel):
    name: str
    car_capacity: int
    bike_capacity: int
    staff_reserved_car: int
    staff_reserved_bike: int
    lat: float
    lng: float
    status: str

    model_config = ConfigDict(from_attributes=True)


class ParkingZoneCreate(ParkingZoneBase):
    pass


class ParkingZoneUpdate(ParkingZoneBase):
    pass


class ParkingZoneResponse(ParkingZoneBase):
    id: int
