"""Session-cookie auth: cookie helpers + the `get_current_user` FastAPI dependency."""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, Request, Response

from lib.db import db

SESSION_COOKIE = "ftth_session"
SESSION_TTL_DAYS = 7


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_dt(value: Any) -> Any:
    """Motor hands naive datetimes back — re-tag UTC so Pydantic emits an offset."""
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


async def create_session(user_id: str, response: Response) -> None:
    token = uuid4().hex
    now = utcnow()
    await db.sessions.insert_one({
        "token": token,
        "user_id": user_id,
        "created_at": now,
        "expires_at": now + timedelta(days=SESSION_TTL_DAYS),
    })
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_TTL_DAYS * 86400,
        httponly=True,
        samesite="lax",
        path="/",
    )


async def destroy_session(request: Request, response: Response) -> None:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await db.sessions.delete_one({"token": token})
    response.delete_cookie(SESSION_COOKIE, path="/")


async def get_current_user(request: Request) -> dict[str, Any]:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    session = await db.sessions.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesi tidak ditemukan")
    expires_at = normalize_dt(session.get("expires_at"))
    if isinstance(expires_at, datetime) and expires_at < utcnow():
        await db.sessions.delete_one({"token": token})
        raise HTTPException(status_code=401, detail="Sesi kedaluwarsa")
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
    user.pop("_id", None)
    return user
