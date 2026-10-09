import asyncio
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self):
        self.active_connections: dict[int, set[WebSocket]] = {}
        self._event_loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self._event_loop = asyncio.get_running_loop()
        self.active_connections.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        connections = self.active_connections.get(user_id)
        if connections is None:
            return
        connections.discard(websocket)
        if not connections:
            self.active_connections.pop(user_id, None)

    async def send_to_user(self, user_id: int, message: dict) -> None:
        connections = tuple(self.active_connections.get(user_id, ()))
        if not connections:
            return

        async def send(websocket: WebSocket) -> None:
            try:
                await websocket.send_json(message)
            except Exception:
                logger.warning(
                    "Dropping failed notification WebSocket for user %s",
                    user_id,
                    exc_info=True,
                )
                self.disconnect(user_id, websocket)

        await asyncio.gather(*(send(websocket) for websocket in connections))

    def publish_notification(self, notification) -> None:
        loop = self._event_loop
        if loop is None or loop.is_closed():
            return

        payload = {
            "id": notification.id,
            "user_id": notification.user_id,
            "target_role": notification.target_role,
            "type": notification.type,
            "title": notification.title,
            "message": notification.message,
            "related_id": notification.related_id,
            "read_status": notification.read_status,
            "created_at": (
                notification.created_at.isoformat()
                if notification.created_at is not None
                else None
            ),
        }
        try:
            asyncio.run_coroutine_threadsafe(
                self.send_to_user(notification.user_id, payload),
                loop,
            )
        except RuntimeError:
            logger.warning("Unable to schedule notification WebSocket broadcast")


websocket_manager = WebSocketManager()