from pydantic import BaseModel, ConfigDict


class BuildingBase(BaseModel):
    name: str
    type: str | None = None
    lat: float
    lng: float
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


class BuildingCreate(BuildingBase):
    pass


class BuildingUpdate(BuildingBase):
    pass


class BuildingResponse(BuildingBase):
    id: int
