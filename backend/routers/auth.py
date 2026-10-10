"""Auth sederhana: login/logout berbasis cookie httpOnly + setup admin pertama."""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.auth import create_session, destroy_session, get_current_user, normalize_dt
from lib.db import db
from lib.security import hash_password, verify_password
from models.auth import AuthStatus, Message, PasswordChange, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/status", response_model=AuthStatus)
async def auth_status(request: Request) -> AuthStatus:
    try:
        user = await get_current_user(request)
        return AuthStatus(authenticated=True, setup_required=False, username=user["username"])
    except HTTPException:
        setup_required = await db.users.count_documents({}) == 0
        return AuthStatus(authenticated=False, setup_required=setup_required, username=None)


@router.post("/setup", response_model=UserOut, status_code=201)
async def setup_admin(input: UserCreate, response: Response) -> UserOut:
    """First-run only: create the admin account when no user exists yet."""
    if await db.users.count_documents({}) > 0:
        raise HTTPException(status_code=403, detail="Akun admin sudah dibuat sebelumnya")
    user = {
        "id": str(uuid4()),
        "username": input.username,
        "password_hash": hash_password(input.password),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user)
    await create_session(user["id"], response)
    return UserOut(**user)


@router.post("/login", response_model=UserOut)
async def login(input: UserLogin, response: Response) -> UserOut:
    user = await db.users.find_one({"username": input.username})
    if not user or not verify_password(input.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    await create_session(user["id"], response)
    return UserOut(
        id=user["id"],
        username=user["username"],
        created_at=normalize_dt(user.get("created_at")),
    )


@router.post("/logout", response_model=Message)
async def logout(request: Request, response: Response) -> Message:
    await destroy_session(request, response)
    return Message(message="Logout berhasil")


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)) -> UserOut:
    return UserOut(
        id=user["id"],
        username=user["username"],
        created_at=normalize_dt(user.get("created_at")),
    )


@router.put("/password", response_model=Message)
async def change_password(input: PasswordChange, user: dict = Depends(get_current_user)) -> Message:
    if not verify_password(input.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Password saat ini salah")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(input.new_password)}},
    )
    return Message(message="Password berhasil diganti")
