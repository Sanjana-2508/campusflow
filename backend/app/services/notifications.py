from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.notification import Notification


def create_notification(
    db: Session,
    *,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    related_id: int | None = None,
    target_role: str | None = None,
    commit: bool = True,
) -> Notification:
    if related_id is not None:
        existing = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.type == notification_type,
                Notification.related_id == related_id,
            )
            .first()
        )
        if existing:
            return existing

    notification = Notification(
        user_id=user_id,
        target_role=target_role,
        type=notification_type,
        title=title,
        message=message,
        related_id=related_id,
        read_status=False,
    )
    db.add(notification)
    db.flush()

    if commit:
        db.commit()
        db.refresh(notification)

    return notification


def list_user_notifications(db: Session, user_id: int) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .all()
    )


def count_unread_notifications(db: Session, user_id: int) -> int:
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.read_status.is_(False),
        )
        .count()
    )


def mark_notification_read(
    db: Session,
    notification_id: int,
    user_id: int,
) -> Notification:
    notification = db.query(Notification).filter(
        Notification.id == notification_id
    ).first()
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notification.user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this notification",
        )

    if not notification.read_status:
        notification.read_status = True
        db.commit()
        db.refresh(notification)
    return notification


def mark_all_notifications_read(db: Session, user_id: int) -> int:
    updated = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.read_status.is_(False),
        )
        .update({Notification.read_status: True}, synchronize_session=False)
    )
    db.commit()
    return updated
