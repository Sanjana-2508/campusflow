from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


ClubVerificationStatus = Literal["PENDING", "APPROVED", "REJECTED"]


class ClubCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Club name cannot be blank")
        return value


class ClubUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Club name cannot be blank")
        return value


class ClubVerificationUpdate(BaseModel):
    verification_status: ClubVerificationStatus


class ClubResponse(BaseModel):
    id: int
    name: str
    description: str | None
    owner_user_id: int
    owner_name: str
    verification_status: ClubVerificationStatus

    model_config = ConfigDict(from_attributes=True)
