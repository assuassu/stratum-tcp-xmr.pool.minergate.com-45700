"""Inventaris perangkat FTTH: CRUD + ringkasan + riwayat ping + ping sekarang."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ASCENDING

from lib.auth import get_current_user, normalize_dt
from lib.db import db
from lib.monitor import ping_and_record
from models.device import Device, DeviceCreate, DeviceUpdate, PingSample, Summary

router = APIRouter(prefix="/devices", tags=["devices"], dependencies=[Depends(get_current_user)])


def _clean(doc: dict) -> dict:
    """Strip Mongo internals and re-tag naive datetimes as UTC."""
    out = {}
    for k, v in doc.items():
        if k == "_id":
            continue
        out[k] = normalize_dt(v)
    return out


async def _get_device_or_404(device_id: str) -> dict:
    device = await db.devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(status_code=404, detail="Perangkat tidak ditemukan")
    return device


async def _uptime_stats() -> dict[str, dict]:
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    cursor = db.ping_results.aggregate([
        {"$match": {"timestamp": {"$gte": since}}},
        {"$group": {
            "_id": "$device_id",
            "total": {"$sum": 1},
            "ok": {"$sum": {"$cond": ["$ok", 1, 0]}},
            "avg_latency": {"$avg": "$latency_ms"},
        }},
    ])
    return {doc["_id"]: doc async for doc in cursor}


def _attach_stats(device_doc: dict, stats: dict[str, dict]) -> Device:
    st = stats.get(device_doc["id"])
    if st and st["total"]:
        device_doc["uptime_24h"] = round(100.0 * st["ok"] / st["total"], 1)
        device_doc["avg_latency_24h"] = (
            round(st["avg_latency"], 2) if st["avg_latency"] is not None else None
        )
    return Device(**device_doc)


@router.get("/summary", response_model=Summary)
async def summary() -> Summary:
    devices = [_clean(d) for d in await db.devices.find().to_list(1000)]
    enabled = [d for d in devices if d["enabled"]]
    up = [d for d in enabled if d["last_status"] == "up"]
    down = [d for d in enabled if d["last_status"] == "down"]
    unknown = [d for d in enabled if d["last_status"] not in ("up", "down")]
    lats = [d["last_latency_ms"] for d in up if d.get("last_latency_ms") is not None]
    last_checks = [d["last_check_at"] for d in enabled if d.get("last_check_at")]
    return Summary(
        total_devices=len(devices),
        online=len(up),
        offline=len(down),
        unknown=len(unknown),
        disabled=len(devices) - len(enabled),
        avg_latency_ms=round(sum(lats) / len(lats), 2) if lats else None,
        last_check_at=max(last_checks) if last_checks else None,
    )


@router.get("", response_model=list[Device])
async def list_devices() -> list[Device]:
    devices = [_clean(d) for d in await db.devices.find().sort("name", ASCENDING).to_list(1000)]
    stats = await _uptime_stats()
    return [_attach_stats(d, stats) for d in devices]


@router.post("", response_model=Device, status_code=201)
async def create_device(input: DeviceCreate) -> Device:
    device = Device(**input.model_dump())
    await db.devices.insert_one(
        device.model_dump(exclude={"uptime_24h", "avg_latency_24h"})
    )
    return device


@router.get("/{device_id}", response_model=Device)
async def get_device(device_id: str) -> Device:
    doc = _clean(await _get_device_or_404(device_id))
    stats = await _uptime_stats()
    return _attach_stats(doc, stats)


@router.put("/{device_id}", response_model=Device)
async def update_device(device_id: str, input: DeviceUpdate) -> Device:
    await _get_device_or_404(device_id)
    changes = input.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan")
    if "host" in changes:  # status lama tidak lagi relevan untuk host baru
        changes.update({"last_status": "unknown", "last_latency_ms": None, "last_check_at": None})
    await db.devices.update_one({"id": device_id}, {"$set": changes})
    doc = _clean(await _get_device_or_404(device_id))
    stats = await _uptime_stats()
    return _attach_stats(doc, stats)


@router.delete("/{device_id}", status_code=204)
async def delete_device(device_id: str) -> None:
    await _get_device_or_404(device_id)
    await db.devices.delete_one({"id": device_id})
    await db.ping_results.delete_many({"device_id": device_id})


@router.get("/{device_id}/history", response_model=list[PingSample])
async def device_history(
    device_id: str,
    hours: int = Query(default=6, ge=1, le=168),
    limit: int = Query(default=2000, ge=1, le=5000),
) -> list[PingSample]:
    await _get_device_or_404(device_id)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    docs = await db.ping_results.find(
        {"device_id": device_id, "timestamp": {"$gte": since}}
    ).sort("timestamp", ASCENDING).to_list(limit)
    return [PingSample(**_clean(d)) for d in docs]


@router.post("/{device_id}/ping", response_model=PingSample)
async def ping_now(device_id: str) -> PingSample:
    device = _clean(await _get_device_or_404(device_id))
    settings = await db.settings.find_one({"key": "app"}) or {}
    timeout = max(1, min(10, int(settings.get("ping_timeout_s", 2))))
    return await ping_and_record(device, timeout_s=timeout)
