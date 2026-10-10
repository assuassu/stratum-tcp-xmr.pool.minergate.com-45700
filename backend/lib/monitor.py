"""FTTH ping worker — runs the REAL system `ping` binary (no shell, no simulation).

The monitor loop pings every enabled device on the configured interval, records each
result in `ping_results` and stamps the device document with its latest status.
"""

import asyncio
import logging
import re
import shutil
from datetime import datetime, timezone
from uuid import uuid4

from lib.db import db
from models.device import PingSample

logger = logging.getLogger(__name__)

TIME_RE = re.compile(r"time[=<]([\d.]+)\s*ms", re.IGNORECASE)


async def run_ping(host: str, timeout_s: int = 2) -> tuple[bool, float | None, str]:
    """One ICMP echo via system ping. Returns (ok, latency_ms, error)."""
    if shutil.which("ping") is None:
        return False, None, "Perintah ping tidak tersedia di server"
    try:
        proc = await asyncio.create_subprocess_exec(
            "ping", "-c", "1", "-W", str(max(1, int(timeout_s))), "-n", host,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except (OSError, ValueError) as exc:
        if isinstance(exc, OSError) and exc.errno == 1:  # EPERM — container tanpa izin ICMP
            return False, None, "Ping diblokir lingkungan (kontainer butuh izin ICMP / CAP_NET_RAW)"
        return False, None, f"Gagal menjalankan ping: {exc}"
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout_s + 5)
    except asyncio.TimeoutError:
        proc.kill()
        return False, None, "Ping melebihi batas waktu"
    if proc.returncode == 0:
        match = TIME_RE.search(stdout.decode(errors="ignore"))
        return True, (float(match.group(1)) if match else None), ""
    err_line = next((l for l in stderr.decode(errors="ignore").splitlines() if l.strip()), "")
    if proc.returncode == 1:
        return False, None, "Host tidak merespons ping"
    low = err_line.lower()
    if "operation not permitted" in low or "operasi tidak diizinkan" in low:
        return False, None, "Ping diblokir lingkungan (kontainer butuh izin ICMP / CAP_NET_RAW)"
    return False, None, err_line or f"Ping gagal (exit {proc.returncode})"


async def ping_and_record(device: dict, timeout_s: int = 2) -> PingSample:
    ok, latency, error = await run_ping(device["host"], timeout_s)
    now = datetime.now(timezone.utc)
    sample = PingSample(
        id=str(uuid4()),
        device_id=device["id"],
        timestamp=now,
        ok=ok,
        latency_ms=latency,
        error=error,
    )
    await db.ping_results.insert_one(sample.model_dump())
    await db.devices.update_one(
        {"id": device["id"]},
        {"$set": {
            "last_status": "up" if ok else "down",
            "last_latency_ms": latency,
            "last_check_at": now,
            "last_error": "" if ok else error,
        }},
    )
    return sample


async def monitor_loop() -> None:
    """Ping every enabled device on the configured cadence (settings collection)."""
    logger.info("Ping monitor dimulai")
    while True:
        try:
            settings = await db.settings.find_one({"key": "app"}) or {}
            interval = max(5, min(3600, int(settings.get("ping_interval_s", 30))))
            timeout = max(1, min(10, int(settings.get("ping_timeout_s", 2))))
            devices = await db.devices.find({"enabled": True}, {"_id": 0}).to_list(1000)
            if devices:
                results = await asyncio.gather(
                    *(ping_and_record(d, timeout_s=timeout) for d in devices),
                    return_exceptions=True,
                )
                failures = [r for r in results if isinstance(r, BaseException)]
                if failures:
                    logger.error("Ping loop: %d perangkat gagal diproses", len(failures))
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Monitor loop error")
        await asyncio.sleep(interval)
