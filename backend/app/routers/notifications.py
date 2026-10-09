from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationResponse,
    UnreadNotificationCount,
)
from app.services.notifications import (
    count_unread_notifications,
    list_user_notifications,
    mark_all_notifications_read,
    mark_notification_read,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationResponse])
def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_user_notifications(db, current_user.id)


@router.get("/unread-count", response_model=UnreadNotificationCount)
def get_unread_notification_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"unread_count": count_unread_notifications(db, current_user.id)}


@router.patch("/read-all")
def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated_count = mark_all_notifications_read(db, current_user.id)
    return {
        "message": "Notifications marked as read",
        "updated_count": updated_count,
    }


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_one_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return mark_notification_read(db, notification_id, current_user.id)
