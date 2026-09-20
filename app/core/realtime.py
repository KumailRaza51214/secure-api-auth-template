"""In-process WebSocket connections for live todo updates."""

from collections import defaultdict

from fastapi import WebSocket


class TodoConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, username: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[username].append(websocket)

    def disconnect(self, username: str, websocket: WebSocket) -> None:
        connections = self._connections.get(username, [])
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            self._connections.pop(username, None)

    async def broadcast(self, username: str, event: dict) -> None:
        for websocket in self._connections.get(username, []).copy():
            try:
                await websocket.send_json(event)
            except Exception:
                self.disconnect(username, websocket)


todo_connections = TodoConnectionManager()
