from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.utils import get_user_id, raise_todo_not_found
from app.dependencies.auth import get_current_user
from app.models.todo import Todo
from app.core.realtime import todo_connections
from app.schemas.todo import TodoCreate, TodoUpdate
from database import get_db

router = APIRouter()


@router.get("/todos")
def get_todos(current_user: dict[str, Any] = Depends(get_current_user), db: Session = Depends(get_db)):
    todos = db.query(Todo).filter(Todo.username == current_user["username"]).order_by(Todo.created_at.desc()).all()
    return [todo.to_dict() for todo in todos]


@router.post("/todos")
async def create_todo(todo: TodoCreate, current_user: dict[str, Any] = Depends(get_current_user), db: Session = Depends(get_db)):
    model_todo = Todo.from_create(todo)
    model_todo.username = current_user["username"]
    model_todo.user_id = get_user_id(current_user["username"])

    db.add(model_todo)
    db.commit()
    db.refresh(model_todo)

    payload = model_todo.to_dict()
    await todo_connections.broadcast(current_user["username"], {"type": "created", "todo": payload})
    return {"message": "Todo created", "todo": payload}


@router.put("/todos/{todo_id}")
async def update_todo(todo_id: int, updated_todo: TodoUpdate, current_user: dict[str, Any] = Depends(get_current_user), db: Session = Depends(get_db)):
    todo = db.query(Todo).filter(Todo.id == todo_id, Todo.username == current_user["username"]).first()
    if todo is None:
        raise_todo_not_found()

    if updated_todo.title is not None:
        todo.title = updated_todo.title.strip()
    if updated_todo.description is not None:
        todo.description = updated_todo.description.strip()
    if updated_todo.completed is not None:
        todo.completed = updated_todo.completed

    db.commit()
    db.refresh(todo)
    payload = todo.to_dict()
    await todo_connections.broadcast(current_user["username"], {"type": "updated", "todo": payload})
    return {"message": "Todo updated", "todo": payload}


@router.patch("/todos/{todo_id}")
async def patch_todo(todo_id: int, updated_todo: TodoUpdate, current_user: dict[str, Any] = Depends(get_current_user), db: Session = Depends(get_db)):
    """Partial update endpoint used by the frontend to toggle completion or edit a todo."""
    todo = db.query(Todo).filter(Todo.id == todo_id, Todo.username == current_user["username"]).first()
    if todo is None:
        raise_todo_not_found()

    if updated_todo.title is not None:
        todo.title = updated_todo.title.strip()
    if updated_todo.description is not None:
        todo.description = updated_todo.description.strip()
    if updated_todo.completed is not None:
        todo.completed = updated_todo.completed

    db.commit()
    db.refresh(todo)
    payload = todo.to_dict()
    await todo_connections.broadcast(current_user["username"], {"type": "updated", "todo": payload})
    return {"message": "Todo updated", "todo": payload}


@router.delete("/todos/{todo_id}")
async def delete_todo(todo_id: int, current_user: dict[str, Any] = Depends(get_current_user), db: Session = Depends(get_db)):
    todo = db.query(Todo).filter(Todo.id == todo_id, Todo.username == current_user["username"]).first()
    if todo is None:
        raise_todo_not_found()

    db.delete(todo)
    db.commit()
    await todo_connections.broadcast(current_user["username"], {"type": "deleted", "todo_id": todo_id})
    return {"message": "Todo deleted"}
