from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    club_id: int | None = Field(default=None, gt=0)
    venue: str | None = Field(default=None, max_length=200)
    venue_building_id: int | None = Field(default=None, gt=0)
    event_date: date
    start_time: time
    end_time: time
    poster: str | None = Field(default=None, max_length=500)
    registration_url: str | None = Field(default=None, max_length=500)
    qr_code: str | None = Field(default=None, max_length=500)
    expected_attendance: int | None = Field(default=None, ge=0)

    model_config = ConfigDict(extra="forbid")

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Event title cannot be blank")
        return value

    @field_validator("start_time", "end_time")
    @classmethod
    def times_must_be_timezone_naive(cls, value: time) -> time:
        if value.tzinfo is not None and value.utcoffset() is not None:
            raise ValueError("Event times must not include a timezone")
        return value


class EventUpdate(EventCreate):
    pass


class EventStatusUpdate(BaseModel):
    status: Literal["DRAFT", "PUBLISHED"]


class EventResponse(BaseModel):
    id: int
    title: str
    description: str | None
    organizer_user_id: int
    organizer_name: str
    club_id: int | None
    club_name: str | None
    venue: str | None
    venue_building_id: int | None
    event_date: date
    start_time: time
    end_time: time
    poster: str | None
    registration_url: str | None
    qr_code: str | None
    expected_attendance: int | None
    status: Literal["DRAFT", "PUBLISHED", "CANCELLED", "REMOVED"]

    model_config = ConfigDict(from_attributes=True)


class EventBookmarkResponse(BaseModel):
    id: int
    user_id: int
    event_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
