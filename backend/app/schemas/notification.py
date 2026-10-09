from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    id: int
    user_id: int | None
    target_role: str | None
    type: str
    title: str
    message: str
    related_id: int | None
    read_status: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UnreadNotificationCount(BaseModel):
    unread_count: int
