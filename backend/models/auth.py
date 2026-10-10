"""Auth models — mirror in frontend/src/lib/types.ts (UserOut, AuthStatus)."""

from datetime import datetime
from uuid import uuid4

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    username: str
    password: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class UserOut(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    username: str
    created_at: datetime | None = None


class AuthStatus(BaseModel):
    authenticated: bool = False
    setup_required: bool = False
    username: str | None = None


class Message(BaseModel):
    message: str
