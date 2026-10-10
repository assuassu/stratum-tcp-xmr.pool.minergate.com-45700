"""Device inventory + ping models — mirror in frontend/src/lib/types.ts."""

from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

DEVICE_TYPES = ("olt", "onu", "ont", "router", "switch", "server", "other")
HOST_PATTERN = r"^[A-Za-z0-9._:-]+$"


class DeviceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    host: str = Field(min_length=1, max_length=253, pattern=HOST_PATTERN)
    type: str = "ont"
    location: str = Field(default="", max_length=120)
    pon_port: str = Field(default="", max_length=60)
    notes: str = Field(default="", max_length=500)
    enabled: bool = True

    @field_validator("type")
    @classmethod
    def check_type(cls, v: str) -> str:
        if v not in DEVICE_TYPES:
            raise ValueError(f"tipe harus salah satu dari: {', '.join(DEVICE_TYPES)}")
        return v


class DeviceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    host: str | None = Field(default=None, min_length=1, max_length=253, pattern=HOST_PATTERN)
    type: str | None = None
    location: str | None = Field(default=None, max_length=120)
    pon_port: str | None = Field(default=None, max_length=60)
    notes: str | None = Field(default=None, max_length=500)
    enabled: bool | None = None

    @field_validator("type")
    @classmethod
    def check_type(cls, v: str | None) -> str | None:
        if v is not None and v not in DEVICE_TYPES:
            raise ValueError(f"tipe harus salah satu dari: {', '.join(DEVICE_TYPES)}")
        return v


class Device(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    host: str
    type: str = "ont"
    location: str = ""
    pon_port: str = ""
    notes: str = ""
    enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_status: str = "unknown"  # up | down | unknown
    last_latency_ms: float | None = None
    last_check_at: datetime | None = None
    last_error: str = ""
    # computed on read, never stored
    uptime_24h: float | None = None
    avg_latency_24h: float | None = None


class PingSample(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    device_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ok: bool
    latency_ms: float | None = None
    error: str = ""


class Summary(BaseModel):
    total_devices: int = 0
    online: int = 0
    offline: int = 0
    unknown: int = 0
    disabled: int = 0
    avg_latency_ms: float | None = None
    last_check_at: datetime | None = None
