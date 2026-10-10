import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Activity, ArrowRight, Gauge, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { apiErrorText } from "@/lib/errors";
import { DEVICE_TYPE_LABELS, type Device, type PingSample, type Summary } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const INTERVALS = [
  { value: "0", label: "Manual" },
  { value: "5", label: "5 detik" },
  { value: "15", label: "15 detik" },
  { value: "30", label: "30 detik" },
];

const FILTERS: { key: string; label: string; match: (d: Device) => boolean }[] = [
  { key: "all", label: "Semua", match: () => true },
  { key: "olt", label: "OLT", match: (d) => d.type === "olt" },
  { key: "ont-onu", label: "ONT/ONU", match: (d) => d.type === "ont" || d.type === "onu" },
  { key: "router", label: "Router", match: (d) => d.type === "router" },
  { key: "server", label: "Server", match: (d) => d.type === "server" },
  { key: "other", label: "Lainnya", match: (d) => d.type === "switch" || d.type === "other" },
];

function KpiCard({
  label,
  value,
  sub,
  icon,
  testId,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  testId: string;
}) {
  return (
    <Card size="sm" data-testid={testId}>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="mt-1 truncate font-heading text-2xl font-semibold tracking-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sky-400">
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("all");
  const [intervalSec, setIntervalSec] = useState(15);

  const refetchMs = intervalSec > 0 ? intervalSec * 1000 : false;

  const qDevices = useQuery({
    queryKey: ["devices"],
    queryFn: () => apiGet<Device[]>("/devices"),
    refetchInterval: refetchMs,
  });
  const qSummary = useQuery({
    queryKey: ["summary"],
    queryFn: () => apiGet<Summary>("/devices/summary"),
    refetchInterval: refetchMs,
  });

  const pingNow = useMutation({
    mutationFn: (device: Device) => apiPost<PingSample>(`/devices/${device.id}/ping`),
    onSuccess: (sample, device) => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      toast.success(
        `${device.name}: ${sample.ok ? `online — ${sample.latency_ms?.toFixed(1) ?? "?"} ms` : "offline"}`
      );
    },
    onError: (err) => toast.error(apiErrorText(err)),
  });

  const devices = qDevices.data ?? [];
  const summary = qSummary.data;
  const activeFilter = FILTERS.find((f) => f.key === typeFilter) ?? FILTERS[0];
  const filtered = devices.filter(activeFilter.match);
  const downDevices = devices.filter((d) => d.enabled && d.last_status === "down");

  return (
    <div data-testid="dashboard-view" className="space-y-5">
      {/* Ribbon alert offline */}
      {downDevices.length > 0 && (
        <div
          data-testid="dashboard-alert-ribbon"
          className="rounded-lg border border-red-900/60 bg-[#7F1D1D]/20 px-4 py-3 text-sm text-red-200"
        >
          <span className="font-semibold">{downDevices.length} perangkat offline:</span>{" "}
          {downDevices.map((d) => d.name).join(", ")}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          testId="kpi-total-devices"
          label="Total Perangkat"
          value={summary ? String(summary.total_devices) : "…"}
          sub={summary && summary.disabled > 0 ? `${summary.disabled} nonaktif` : "semua dimonitor"}
          icon={<Activity className="h-5 w-5" />}
        />
        <KpiCard
          testId="kpi-online-devices"
          label="Online"
          value={summary ? String(summary.online) : "…"}
          sub="ping berhasil"
          icon={<Wifi className="h-5 w-5" />}
        />
        <KpiCard
          testId="kpi-offline-devices"
          label="Offline"
          value={summary ? String(summary.offline) : "…"}
          sub={summary && summary.unknown > 0 ? `${summary.unknown} belum dipantau` : undefined}
          icon={<WifiOff className="h-5 w-5" />}
        />
        <KpiCard
          testId="kpi-avg-latency"
          label="Latensi Rata-rata"
          value={summary?.avg_latency_ms != null ? `${summary.avg_latency_ms.toFixed(1)} ms` : "—"}
          sub="perangkat online"
          icon={<Gauge className="h-5 w-5" />}
        />
      </div>

      {/* Tabel status perangkat */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  data-testid={`device-filter-chip-${f.key}`}
                  data-selected={typeFilter === f.key}
                  onClick={() => setTypeFilter(f.key)}
                  className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors duration-200 ease-out ${
                    typeFilter === f.key
                      ? "border-sky-600 bg-sky-500/15 text-sky-300"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Auto-refresh
              </span>
              <Select value={String(intervalSec)} onValueChange={(v: string) => setIntervalSec(Number(v))}>
                <SelectTrigger size="sm" className="w-32" data-testid="refresh-interval-select">
                  <SelectValue>
                    {(v: string) => INTERVALS.find((i) => i.value === v)?.label ?? "15 detik"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INTERVALS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {qDevices.isError ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Gagal memuat data perangkat — backend tidak terjangkau.
              </p>
              <Button variant="outline" size="sm" onClick={() => qDevices.refetch()}>
                <RefreshCw className="h-4 w-4" /> Coba lagi
              </Button>
            </div>
          ) : qDevices.isPending ? (
            <div className="space-y-2 py-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">Belum ada perangkat pada filter ini.</p>
              <Link to="/devices" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Kelola Perangkat
              </Link>
            </div>
          ) : (
            <Table data-testid="device-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Perangkat</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="hidden md:table-cell">Lokasi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Uptime 24 Jam</TableHead>
                  <TableHead className="hidden lg:table-cell">Cek Terakhir</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id} data-testid={`device-row-${d.id}`}>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link
                          to={`/devices/${d.id}`}
                          className="font-medium hover:text-sky-400"
                          data-testid={`device-link-${d.id}`}
                        >
                          {d.name}
                        </Link>
                        <span className="font-mono text-xs text-muted-foreground">{d.host}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[11px] uppercase tracking-wider">
                        {DEVICE_TYPE_LABELS[d.type] ?? d.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {d.location || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={d.last_status} testId={`device-status-badge-${d.id}`} />
                        <span
                          className={`font-mono text-xs ${
                            d.last_status === "up" && d.last_latency_ms != null
                              ? d.last_latency_ms >= 100
                                ? "text-amber-300"
                                : "text-emerald-300"
                              : "text-muted-foreground"
                          }`}
                        >
                          {d.last_latency_ms != null ? `${d.last_latency_ms.toFixed(1)} ms` : "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full transition-all duration-200 ease-out"
                            style={{
                              width: `${d.uptime_24h ?? 0}%`,
                              backgroundColor:
                                (d.uptime_24h ?? 0) >= 99
                                  ? "#34D399"
                                  : (d.uptime_24h ?? 0) >= 90
                                    ? "#FBBF24"
                                    : "#F87171",
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs">
                          {d.uptime_24h != null ? `${d.uptime_24h.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {d.last_check_at
                        ? formatDistanceToNow(new Date(d.last_check_at), {
                            addSuffix: true,
                            locale: localeId,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Ping ${d.name} sekarang`}
                          data-testid={`device-ping-now-btn-${d.id}`}
                          disabled={pingNow.isPending}
                          onClick={() => pingNow.mutate(d)}
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${
                              pingNow.variables?.id === d.id && pingNow.isPending ? "animate-spin" : ""
                            }`}
                          />
                        </Button>
                        <Link
                          to={`/devices/${d.id}`}
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          aria-label={`Detail ${d.name}`}
                          data-testid={`device-detail-btn-${d.id}`}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
