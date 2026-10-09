from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User
from app.services.websocket_manager import websocket_manager

router = APIRouter(tags=["Notifications WebSocket"])


def _extract_token(websocket: WebSocket, query_token: str | None) -> str | None:
    authorization = websocket.headers.get("authorization")
    if authorization:
        scheme, separator, token = authorization.partition(" ")
        if separator and scheme.lower() == "bearer" and token:
            return token
        return None
    return query_token


@router.websocket("/ws/notifications")
async def notification_websocket(
    websocket: WebSocket,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    access_token = _extract_token(websocket, token)
    if not access_token:
        await websocket.close(code=1008, reason="Authentication required")
        return

    try:
        user_id = decode_access_token(access_token)
    except Exception:
        await websocket.close(code=1008, reason="Invalid or expired token")
        return

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        await websocket.close(code=1008, reason="User not found")
        return

    authenticated_user_id = user.id
    db.close()

    await websocket_manager.connect(authenticated_user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        websocket_manager.disconnect(authenticated_user_id, websocket)
