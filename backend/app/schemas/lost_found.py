from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


LostFoundType = Literal["LOST", "FOUND"]
LostFoundStatus = Literal["OPEN", "RESOLVED", "REMOVED"]


class LostFoundCreate(BaseModel):
    type: LostFoundType
    item_name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    location: str | None = Field(default=None, max_length=200)
    item_date: date | None = None
    image: str | None = Field(default=None, max_length=500)
    contact: str | None = Field(default=None, max_length=200)

    model_config = ConfigDict(extra="forbid")

    @field_validator("item_name")
    @classmethod
    def item_name_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Item name cannot be blank")
        return value


class LostFoundUpdate(BaseModel):
    item_name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    location: str | None = Field(default=None, max_length=200)
    item_date: date | None = None
    image: str | None = Field(default=None, max_length=500)
    contact: str | None = Field(default=None, max_length=200)

    model_config = ConfigDict(extra="forbid")

    @field_validator("item_name")
    @classmethod
    def item_name_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("Item name cannot be null")
        value = value.strip()
        if not value:
            raise ValueError("Item name cannot be blank")
        return value


class LostFoundStatusUpdate(BaseModel):
    status: LostFoundStatus


class LostFoundResponse(BaseModel):
    id: int
    user_id: int
    reporter_name: str
    type: LostFoundType
    item_name: str
    description: str | None
    location: str | None
    item_date: date | None
    image: str | None
    contact: str | None
    status: LostFoundStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
