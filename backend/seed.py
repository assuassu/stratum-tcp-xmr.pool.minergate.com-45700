"""Idempotent seed: akun admin awal + contoh perangkat FTTH + riwayat ping sintetis.

Run: cd /app/backend && python seed.py
"""

import asyncio
import random
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from lib.db import db, ensure_indexes
from lib.security import hash_password

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

# (name, host, type, location, pon_port, notes, base_latency_ms, jitter_ms, up)
DEVICES = [
    ("OLT ZTE ZXA10 C320 - Pusat", "10.10.10.2", "olt", "STO Kramat - Rack 02", "PON 1/1", "OLT utama layanan FTTH", 1.2, 0.8, True),
    ("Router Core MikroTik CCR2004", "10.10.10.1", "router", "STO Kramat - Rack 01", "", "Core router / upstream", 0.7, 0.4, True),
    ("ONT ZTE F660 - ODP KMY-01", "10.20.30.15", "ont", "ODP KMY-01 Port 3", "PON 1/2", "Paket 30 Mbps", 3.5, 1.5, True),
    ("ONT Huawei HG8245H - ODP SDM-03", "10.20.30.22", "ont", "ODP SDM-03 Port 7", "PON 1/3", "Paket 20 Mbps", 5.2, 2.0, True),
    ("DNS Google", "8.8.8.8", "server", "Publik", "", "Resolver upstream", 18.0, 5.0, True),
    ("DNS Cloudflare", "1.1.1.1", "server", "Publik", "", "Resolver cadangan", 14.0, 4.0, True),
    ("ONT Pelanggan - ODP PLT-07", "10.20.40.51", "ont", "ODP PLT-07 Port 1", "PON 1/4", "Contoh pelanggan offline", 6.0, 2.5, False),
]

# nama anak -> nama induk; membentuk hierarki Router Core → OLT → ONT untuk Peta Topologi
PARENTS = {
    "OLT ZTE ZXA10 C320 - Pusat": "Router Core MikroTik CCR2004",
    "ONT ZTE F660 - ODP KMY-01": "OLT ZTE ZXA10 C320 - Pusat",
    "ONT Huawei HG8245H - ODP SDM-03": "OLT ZTE ZXA10 C320 - Pusat",
    "ONT Pelanggan - ODP PLT-07": "OLT ZTE ZXA10 C320 - Pusat",
}

HOURS_BACK = 6
STEP_SECONDS = 120


async def seed() -> None:
    await ensure_indexes()

    if await db.users.count_documents({}) == 0:
        await db.users.insert_one({
            "id": str(uuid4()),
            "username": ADMIN_USERNAME,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "created_at": datetime.now(timezone.utc),
        })
        print(f"Akun admin dibuat: {ADMIN_USERNAME} / {ADMIN_PASSWORD}")

    if await db.devices.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        for name, host, dtype, location, pon_port, notes, base, jitter, up in DEVICES:
            device_id = str(uuid4())
            await db.devices.insert_one({
                "id": device_id,
                "name": name,
                "host": host,
                "type": dtype,
                "location": location,
                "pon_port": pon_port,
                "notes": notes,
                "enabled": True,
                "parent_id": "",
                "created_at": now - timedelta(days=30),
                "last_status": "up" if up else "down",
                "last_latency_ms": round(max(0.2, random.gauss(base, jitter)), 2) if up else None,
                "last_check_at": now - timedelta(seconds=STEP_SECONDS),
                "last_error": "" if up else "Host tidak merespons ping",
            })
            samples = []
            for age in range(HOURS_BACK * 3600 // STEP_SECONDS):
                ts = now - timedelta(seconds=age * STEP_SECONDS)
                if up:
                    ok = random.random() > 0.01
                    samples.append({
                        "id": str(uuid4()),
                        "device_id": device_id,
                        "timestamp": ts,
                        "ok": ok,
                        "latency_ms": round(max(0.2, random.gauss(base, jitter)), 2) if ok else None,
                        "error": "" if ok else "Ping hilang",
                    })
                else:
                    samples.append({
                        "id": str(uuid4()),
                        "device_id": device_id,
                        "timestamp": ts,
                        "ok": False,
                        "latency_ms": None,
                        "error": "Host tidak merespons ping",
                    })
            await db.ping_results.insert_many(samples)
        print(f"{len(DEVICES)} perangkat contoh + riwayat ping {HOURS_BACK} jam dibuat")
    else:
        print("Data perangkat sudah ada — seed dilewati")

    await link_topology()


async def link_topology() -> None:
    """Tetapkan parent_id sesuai PARENTS untuk perangkat yang belum punya induk (idempoten)."""
    linked = 0
    for child_name, parent_name in PARENTS.items():
        parent = await db.devices.find_one({"name": parent_name}, {"id": 1})
        if not parent:
            continue
        result = await db.devices.update_one(
            {"name": child_name, "$or": [{"parent_id": ""}, {"parent_id": {"$exists": False}}]},
            {"$set": {"parent_id": parent["id"]}},
        )
        linked += result.modified_count
    if linked:
        print(f"{linked} relasi topologi (induk) ditetapkan")


if __name__ == "__main__":
    asyncio.run(seed())
