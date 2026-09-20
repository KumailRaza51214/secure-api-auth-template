from datetime import datetime, timedelta, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from app.core.auth import create_access_token, decode_access_token
from app.core.realtime import todo_connections
from app.core.utils import get_user_id, prepare_todo_payload
from app.dependencies.admin import get_admin_user
from app.dependencies.auth import get_current_user
from app.models.todo import Todo
from app.routes.todos import router as todos_router
from app.schemas.todo import TodoCreate, TodoUpdate
from database import SessionLocal, initialize_db

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(todos_router)
security = HTTPBearer()

initialize_db()


@app.websocket("/ws/todos")
async def todo_updates(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token", "")
    try:
        username = decode_access_token(token).get("sub")
    except HTTPException:
        await websocket.close(code=1008)
        return
    if not username:
        await websocket.close(code=1008)
        return

    await todo_connections.connect(username, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        todo_connections.disconnect(username, websocket)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)


@app.get("/", response_class=HTMLResponse)
def home() -> HTMLResponse:
    with open("frontends/web/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/login")
def login(payload: LoginRequest) -> dict[str, str]:
    token = create_access_token({"sub": payload.username})
    return {"access_token": token, "token_type": "bearer", "username": payload.username}


@app.post("/auth/admin-login")
def admin_login(payload: LoginRequest) -> dict[str, str]:
    """Admin login — only Kumail and Abbas can authenticate."""
    if payload.username not in {"Kumail", "Abbas"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only admins (Kumail, Abbas) can log in here.",
        )
    token = create_access_token({"sub": payload.username})
    return {"access_token": token, "token_type": "bearer", "username": payload.username}


@app.get("/db", response_class=HTMLResponse)
def db_viewer() -> HTMLResponse:
    with open("database/db_viewer.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@app.get("/api/db/todos")
def api_db_todos(admin: dict[str, Any] = Depends(get_admin_user)) -> list[dict[str, Any]]:
    """Expose all todos (admin-only) for the database viewer UI."""
    db = SessionLocal()
    try:
        todos = db.query(Todo).order_by(Todo.id.desc()).all()
        return [todo.to_dict() for todo in todos]
    finally:
        db.close()


@app.delete("/api/db/todos/{todo_id}")
def api_db_delete_todo(todo_id: int, admin: dict[str, Any] = Depends(get_admin_user)) -> dict[str, str]:
    """Admin-only delete of any todo in the database."""
    db = SessionLocal()
    try:
        todo = db.query(Todo).filter(Todo.id == todo_id).first()
        if todo is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
        db.delete(todo)
        db.commit()
        return {"message": "Todo deleted"}
    finally:
        db.close()

