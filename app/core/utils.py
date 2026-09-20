from typing import Any

from fastapi import HTTPException, status


def prepare_todo_payload(todo: dict[str, Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for field in ("title", "description"):
        if field in todo:
            payload[field] = todo[field]
    payload.pop("id", None)
    return payload


def get_user_id(username: str) -> int:
    return sum(ord(char) for char in username)


def raise_todo_not_found() -> None:
    raise HTTPException(status_code=404, detail="Todo not found")
