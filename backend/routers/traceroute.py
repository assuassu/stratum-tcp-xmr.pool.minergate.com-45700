"""Traceroute asli via binary `traceroute`/`tracepath` sistem — hasil terstruktur hop-by-hop."""

import asyncio
import os
import re
import shutil
import time

from fastapi import APIRouter, Depends

from lib.auth import get_current_user
from models.traceroute import TraceHop, TraceResult, TracerouteRequest

router = APIRouter(prefix="/traceroute", tags=["traceroute"], dependencies=[Depends(get_current_user)])

HOP_RE = re.compile(r"^\s*(\d+)\s*[:?]?\s+(.*)$")


def _parse_hops(raw: str) -> list[TraceHop]:
    hops: list[TraceHop] = []
    for line in raw.splitlines():
        m = HOP_RE.match(line)
        if not m:
            continue
        rest = m.group(2)
        latencies = [float(x) for x in re.findall(r"([\d.]+)\s*ms", rest)]
        ip_m = re.search(r"\(([^)]+)\)", rest)
        head = rest.split("(")[0].strip().rstrip("?").strip()
        hostname = head if head and set(head) != {"*"} else ""
        hops.append(TraceHop(
            hop=int(m.group(1)),
            hostname=hostname,
            ip=ip_m.group(1) if ip_m else "",
            latencies_ms=latencies,
            reached=bool(latencies),
        ))
    return hops


@router.post("", response_model=TraceResult)
async def run_traceroute(input: TracerouteRequest) -> TraceResult:
    tool = shutil.which("traceroute") or shutil.which("tracepath")
    if not tool:
        return TraceResult(
            target=input.host,
            error=(
                "Perintah traceroute tidak ditemukan di server. "
                "Install dengan: sudo apt install traceroute"
            ),
        )
    if tool.endswith("tracepath"):
        cmd = [tool, "-m", str(input.max_hops), input.host]
    else:
        cmd = [tool, "-q", "1", "-w", str(input.timeout_s), "-m", str(input.max_hops), input.host]

    started = time.monotonic()
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except OSError as exc:
        return TraceResult(target=input.host, error=f"Gagal menjalankan traceroute: {exc}")
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=input.max_hops * input.timeout_s * 3 + 10,
        )
    except asyncio.TimeoutError:
        proc.kill()
        return TraceResult(target=input.host, error="Traceroute melebihi batas waktu")

    duration_ms = int((time.monotonic() - started) * 1000)
    raw = stdout.decode(errors="ignore")
    err_text = stderr.decode(errors="ignore").strip()
    hops = _parse_hops(raw)
    error = ""
    if proc.returncode != 0 and not hops:
        error = err_text or f"Traceroute gagal (exit {proc.returncode})"
    output = raw + (f"\n{err_text}" if err_text else "")
    return TraceResult(
        target=input.host,
        tool=os.path.basename(tool),
        hops=hops,
        raw_output=output.strip(),
        duration_ms=duration_ms,
        error=error,
    )
