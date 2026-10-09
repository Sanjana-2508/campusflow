from pydantic import BaseModel, ConfigDict


class GateBase(BaseModel):
    name: str
    lat: float
    lng: float
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


class GateCreate(GateBase):
    pass


class GateUpdate(GateBase):
    pass


class GateResponse(GateBase):
    id: int
