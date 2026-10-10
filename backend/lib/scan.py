"""Ping sweep + TCP probe untuk pemindaian subnet — semua asyncio, tanpa shell.

Host dianggap aktif jika ping berhasil ATAU salah satu port umum terbuka —
cara TCP menolong di lingkungan kontainer yang memblokir ICMP.
"""

import asyncio
import ipaddress

from lib.monitor import run_ping

# Port umum perangkat jaringan: ssh, telnet, dns, http, https, alt-http, winbox (MikroTik)
TCP_PORTS = [22, 23, 53, 80, 443, 8080, 8443, 8291]
MAX_HOSTS = 256  # maksimum /24
CONCURRENCY = 128


async def _tcp_probe(ip: str, port: int, timeout_s: float) -> bool:
    try:
        _, writer = await asyncio.wait_for(asyncio.open_connection(ip, port), timeout=timeout_s)
    except Exception:
        return False
    writer.close()
    try:
        await writer.wait_closed()
    except Exception:
        pass
    return True


async def sweep_subnet(cidr: str, timeout_s: float = 1.0) -> tuple[list[dict], int, str]:
    """Returns (hits, total_scanned, error)."""
    try:
        net = ipaddress.ip_network(cidr, strict=False)
    except ValueError:
        return [], 0, "Format subnet tidak valid — gunakan notasi CIDR, mis. 192.168.1.0/24"
    if net.version != 4:
        return [], 0, "Hanya subnet IPv4 yang didukung"
    if net.num_addresses > MAX_HOSTS:
        return [], 0, "Subnet terlalu besar — maksimum /24 (256 host)"

    hosts = [str(h) for h in net.hosts()] or [str(net.network_address)]
    sem = asyncio.Semaphore(CONCURRENCY)

    async def probe(ip: str) -> dict | None:
        async with sem:
            ok, latency, _err = await run_ping(ip, timeout_s=max(1, int(timeout_s)))
            if ok:
                return {"ip": ip, "method": "ping", "latency_ms": latency, "ports": []}
            ports: list[int] = []
            for port in TCP_PORTS:
                if await _tcp_probe(ip, port, timeout_s):
                    ports.append(port)
            if ports:
                return {"ip": ip, "method": "tcp", "latency_ms": None, "ports": ports}
            return None

    results = await asyncio.gather(*(probe(h) for h in hosts))
    hits = [r for r in results if r is not None]
    return hits, len(hosts), ""
