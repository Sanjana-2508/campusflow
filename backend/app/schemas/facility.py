from pydantic import BaseModel, ConfigDict


class FacilityBase(BaseModel):
    building_id: int | None = None
    name: str
    category: str | None = None
    lat: float
    lng: float
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


class FacilityCreate(FacilityBase):
    pass


class FacilityUpdate(FacilityBase):
    pass


class FacilityResponse(FacilityBase):
    id: int
