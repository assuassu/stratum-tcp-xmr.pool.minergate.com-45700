"""Pengaturan aplikasi (interval ping, threshold latensi, timeout) + info sistem."""

import os
import platform
import shutil
import socket

from fastapi import APIRouter, Depends, Request

from lib.auth import get_current_user
from lib.db import db
from models.settings import AppSettings, SystemInfo

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(get_current_user)])

SETTINGS_KEY = "app"


async def load_settings() -> AppSettings:
    doc = await db.settings.find_one({"key": SETTINGS_KEY})
    if not doc:
        return AppSettings()
    doc.pop("_id", None)
    doc.pop("key", None)
    return AppSettings(**doc)


@router.get("", response_model=AppSettings)
async def get_settings() -> AppSettings:
    return await load_settings()


@router.put("", response_model=AppSettings)
async def update_settings(input: AppSettings) -> AppSettings:
    await db.settings.update_one(
        {"key": SETTINGS_KEY}, {"$set": input.model_dump()}, upsert=True
    )
    return input


@router.get("/system", response_model=SystemInfo)
async def system_info(request: Request) -> SystemInfo:
    task = getattr(request.app.state, "monitor_task", None)
    tool = shutil.which("traceroute") or shutil.which("tracepath") or ""
    return SystemInfo(
        hostname=socket.gethostname(),
        platform=f"{platform.system()} {platform.release()}",
        ping_available=shutil.which("ping") is not None,
        traceroute_tool=os.path.basename(tool) if tool else "",
        monitor_running=bool(task and not task.done()),
    )
