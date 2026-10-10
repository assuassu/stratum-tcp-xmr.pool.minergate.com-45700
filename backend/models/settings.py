"""App settings + system info models — mirror in frontend/src/lib/types.ts."""

from pydantic import BaseModel, Field


class AppSettings(BaseModel):
    ping_interval_s: int = Field(default=30, ge=5, le=3600)
    latency_warn_ms: float = Field(default=100, ge=1, le=10000)
    ping_timeout_s: int = Field(default=2, ge=1, le=10)


class SystemInfo(BaseModel):
    hostname: str = ""
    platform: str = ""
    ping_available: bool = False
    traceroute_tool: str = ""
    monitor_running: bool = False
