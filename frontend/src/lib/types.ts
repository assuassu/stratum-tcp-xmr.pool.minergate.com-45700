// Hand-written mirrors of the Pydantic models in backend/models — keep in sync in the same edit.

export type DeviceType = "olt" | "onu" | "ont" | "router" | "switch" | "server" | "other";
export type DeviceStatus = "up" | "down" | "unknown";

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  olt: "OLT",
  onu: "ONU",
  ont: "ONT",
  router: "Router",
  switch: "Switch",
  server: "Server",
  other: "Lainnya",
};

export interface Device {
  id: string;
  name: string;
  host: string;
  type: DeviceType;
  location: string;
  pon_port: string;
  notes: string;
  enabled: boolean;
  parent_id: string;
  created_at: string;
  last_status: DeviceStatus;
  last_latency_ms: number | null;
  last_check_at: string | null;
  last_error: string;
  uptime_24h: number | null;
  avg_latency_24h: number | null;
}

export interface DeviceCreate {
  name: string;
  host: string;
  type: DeviceType;
  location: string;
  pon_port: string;
  notes: string;
  enabled: boolean;
  parent_id: string;
}

export type DeviceUpdate = Partial<DeviceCreate>;

export interface RowError {
  row: number;
  message: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  failed: number;
  errors: RowError[];
}

export interface ScanHit {
  ip: string;
  method: string;
  latency_ms: number | null;
  ports: number[];
}

export interface ScanResult {
  cidr: string;
  total_scanned: number;
  found: ScanHit[];
  duration_ms: number;
  error: string;
}

export interface PingSample {
  id: string;
  device_id: string;
  timestamp: string;
  ok: boolean;
  latency_ms: number | null;
  error: string;
}

export interface Summary {
  total_devices: number;
  online: number;
  offline: number;
  unknown: number;
  disabled: number;
  avg_latency_ms: number | null;
  last_check_at: string | null;
}

export interface TracerouteRequest {
  host: string;
  max_hops: number;
  timeout_s: number;
}

export interface TraceHop {
  hop: number;
  hostname: string;
  ip: string;
  latencies_ms: number[];
  reached: boolean;
}

export interface TraceResult {
  target: string;
  tool: string;
  hops: TraceHop[];
  raw_output: string;
  duration_ms: number;
  error: string;
}

export interface UserOut {
  id: string;
  username: string;
  created_at: string | null;
}

export interface AuthStatus {
  authenticated: boolean;
  setup_required: boolean;
  username: string | null;
}

export interface AppSettings {
  ping_interval_s: number;
  latency_warn_ms: number;
  ping_timeout_s: number;
}

export interface SystemInfo {
  hostname: string;
  platform: string;
  ping_available: boolean;
  traceroute_tool: string;
  monitor_running: boolean;
}
