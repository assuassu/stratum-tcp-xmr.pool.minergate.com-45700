"""Traceroute models — mirror in frontend/src/lib/types.ts."""

from pydantic import BaseModel, Field

from models.device import HOST_PATTERN


class TracerouteRequest(BaseModel):
    host: str = Field(min_length=1, max_length=253, pattern=HOST_PATTERN)
    max_hops: int = Field(default=15, ge=1, le=30)
    timeout_s: float = Field(default=2, ge=0.5, le=10)


class TraceHop(BaseModel):
    hop: int
    hostname: str = ""
    ip: str = ""
    latencies_ms: list[float] = Field(default_factory=list)
    reached: bool = False


class TraceResult(BaseModel):
    target: str
    tool: str = "traceroute"
    hops: list[TraceHop] = Field(default_factory=list)
    raw_output: str = ""
    duration_ms: int = 0
    error: str = ""
