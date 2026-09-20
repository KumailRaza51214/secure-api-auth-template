from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import Any

from sqlalchemy import Boolean, DateTime, Integer, String, Text, Enum as SAEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Todo(Base):
    __tablename__ = "todos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    @classmethod
    def from_create(cls, todo: Any) -> "Todo":
        return cls(
            title=todo.title.strip(),
            description=todo.description.strip() if todo.description is not None else None,
            completed=False,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "completed": self.completed,
            "username": self.username,
            "user_id": self.user_id,
            "created_at": self.created_at,
        }
