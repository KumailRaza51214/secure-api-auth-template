import os
from typing import Iterator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

load_dotenv()

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _get_database_url() -> str:
    print("Using local SQLite database.")
    return f"sqlite:///{os.path.join(_BASE_DIR, 'todos.db')}"


def get_database_url() -> str:
    return _get_database_url()


DATABASE_URL = _get_database_url()

# For SQLite, allow connections to be used across threads (FastAPI runs sync
# endpoints in a threadpool) and re-check connections to avoid stale connections.
_is_sqlite = DATABASE_URL.startswith("sqlite")
_engine_kwargs: dict[str, object] = {"echo": False}
if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
    _engine_kwargs["pool_pre_ping"] = True
else:
    _engine_kwargs["pool_pre_ping"] = True

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def initialize_db() -> None:
    try:
        from app.models.todo import Base

        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        print(f"Database initialization skipped: {exc}")


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

