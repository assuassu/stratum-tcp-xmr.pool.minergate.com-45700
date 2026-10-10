"""Inventaris perangkat FTTH: CRUD + ringkasan + riwayat ping + ping sekarang + impor + scan."""

import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError
from pymongo import ASCENDING

from lib.auth import get_current_user, normalize_dt
from lib.db import db
from lib.monitor import ping_and_record
from lib.scan import sweep_subnet
from models.device import (
    Device,
    DeviceCreate,
    DeviceUpdate,
    ImportRequest,
    ImportResult,
    PingSample,
    RowError,
    ScanHit,
    ScanRequest,
    ScanResult,
    Summary,
)

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


async def _parent_valid(device_id: str, parent_id: str) -> bool:
    """Induk harus ada dan rantai induk tidak boleh membentuk siklus."""
    seen = {device_id}
    current = parent_id
    for _ in range(20):
        if not current:
            return True
        if current in seen:
            return False
        seen.add(current)
        doc = await db.devices.find_one({"id": current}, {"parent_id": 1})
        if not doc:
            return False
        current = doc.get("parent_id", "")
    return False


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
    if device.parent_id and not await _parent_valid("", device.parent_id):
        raise HTTPException(status_code=400, detail="Perangkat induk tidak valid (tidak ditemukan)")
    await db.devices.insert_one(
        device.model_dump(exclude={"uptime_24h", "avg_latency_24h"})
    )
    return device


@router.post("/import", response_model=ImportResult)
async def import_devices(input: ImportRequest) -> ImportResult:
    """Impor massal (hasil parse CSV di frontend): baris valid dibuat, sisanya dilaporkan."""
    existing = {
        f"{d['name']}|{d['host']}"
        for d in await db.devices.find({}, {"name": 1, "host": 1, "_id": 0}).to_list(5000)
    }
    result = ImportResult()
    for row_num, item in enumerate(input.items, start=1):
        try:
            candidate = DeviceCreate(**item)
        except ValidationError as exc:
            first = exc.errors()[0]
            loc = ".".join(str(p) for p in first.get("loc", []))
            message = f"{loc}: {first.get('msg', 'tidak valid')}" if loc else str(first.get("msg", "tidak valid"))
            result.failed += 1
            result.errors.append(RowError(row=row_num, message=message))
            continue
        if candidate.parent_id and not await _parent_valid("", candidate.parent_id):
            result.failed += 1
            result.errors.append(RowError(row=row_num, message="Perangkat induk tidak valid"))
            continue
        key = f"{candidate.name}|{candidate.host}"
        if key in existing:
            result.skipped += 1
            continue
        obj = Device(**candidate.model_dump())
        await db.devices.insert_one(obj.model_dump(exclude={"uptime_24h", "avg_latency_24h"}))
        existing.add(key)
        result.created += 1
    return result


@router.post("/scan", response_model=ScanResult)
async def scan(input: ScanRequest) -> ScanResult:
    """Ping sweep + probe TCP sebuah subnet (maks /24)."""
    started = time.monotonic()
    hits, total, error = await sweep_subnet(input.cidr, input.timeout_s)
    return ScanResult(
        cidr=input.cidr,
        total_scanned=total,
        found=[ScanHit(**h) for h in hits],
        duration_ms=int((time.monotonic() - started) * 1000),
        error=error,
    )


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
    if changes.get("parent_id") and not await _parent_valid(device_id, changes["parent_id"]):
        raise HTTPException(
            status_code=400, detail="Perangkat induk tidak valid (tidak ditemukan / siklus terdeteksi)"
        )
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
    # anak-anak menjadi perangkat akar agar topologi tidak menggantung
    await db.devices.update_many({"parent_id": device_id}, {"$set": {"parent_id": ""}})


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
