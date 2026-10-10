import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { apiErrorText } from "@/lib/errors";
import { DEVICE_TYPE_LABELS, type AppSettings, type Device, type PingSample } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import LatencyChart from "@/components/LatencyChart";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const RANGES = [6, 24, 72];

export default function DeviceDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [hours, setHours] = useState(24);

  const qDevice = useQuery({
    queryKey: ["device", id],
    queryFn: () => apiGet<Device>(`/devices/${id}`),
  });
  const qHistory = useQuery({
    queryKey: ["device-history", id, hours],
    queryFn: () => apiGet<PingSample[]>(`/devices/${id}/history?hours=${hours}`),
    refetchInterval: 30_000,
  });
  const qSettings = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<AppSettings>("/settings"),
    staleTime: 60_000,
  });

  const pingNow = useMutation({
    mutationFn: () => apiPost<PingSample>(`/devices/${id}/ping`),
    onSuccess: (sample) => {
      qc.invalidateQueries({ queryKey: ["device", id] });
      qc.invalidateQueries({ queryKey: ["device-history"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      toast.success(
        sample.ok ? `Ping berhasil — ${sample.latency_ms?.toFixed(1) ?? "?"} ms` : `Ping gagal: ${sample.error}`
      );
    },
    onError: (err) => toast.error(apiErrorText(err)),
  });

  if (qDevice.isPending) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (qDevice.isError || !qDevice.data) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Perangkat tidak ditemukan atau backend tidak terjangkau.
        </p>
        <Link to="/devices" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft className="h-4 w-4" /> Kembali ke Inventaris
        </Link>
      </div>
    );
  }

  const d = qDevice.data;
  const warnMs = qSettings.data?.latency_warn_ms ?? 100;
  const hist = qHistory.data ?? [];
  const okCount = hist.filter((s) => s.ok).length;
  const uptimeRange = hist.length ? Math.round((1000 * okCount) / hist.length) / 10 : null;
  const lats = hist
    .filter((s) => s.ok && s.latency_ms != null)
    .map((s) => s.latency_ms as number);
  const avgRange = lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : null;
  const recent = [...hist].slice(-30).reverse();

  return (
    <div data-testid="device-detail-view" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/devices"
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            aria-label="Kembali ke inventaris"
            data-testid="device-detail-back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight">{d.name}</h2>
            <p className="font-mono text-xs text-muted-foreground">
              {d.host} · {DEVICE_TYPE_LABELS[d.type] ?? d.type}
              {d.location ? ` · ${d.location}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={d.last_status} testId="device-detail-status-badge" />
          <Button
            size="sm"
            disabled={pingNow.isPending}
            onClick={() => pingNow.mutate()}
            data-testid="device-detail-ping-btn"
          >
            <RefreshCw className={`h-4 w-4 ${pingNow.isPending ? "animate-spin" : ""}`} /> Ping Sekarang
          </Button>
        </div>
      </div>

      {d.last_error && (
        <div className="rounded-lg border border-red-900/60 bg-[#7F1D1D]/20 px-4 py-3 text-sm text-red-200">
          {d.last_error}
        </div>
      )}

      {/* Metrik ringkas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card size="sm">
          <CardContent>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Uptime 24 Jam
            </p>
            <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">
              {d.uptime_24h != null ? `${d.uptime_24h.toFixed(1)}%` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Uptime {hours} Jam
            </p>
            <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">
              {uptimeRange != null ? `${uptimeRange.toFixed(1)}%` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Latensi Rata-rata
            </p>
            <p className="mt-1 font-heading text-2xl font-semibold tracking-tight text-sky-400">
              {avgRange != null ? `${avgRange.toFixed(1)} ms` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Latensi Terakhir
            </p>
            <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">
              {d.last_latency_ms != null ? `${d.last_latency_ms.toFixed(1)} ms` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grafik latensi */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="font-heading text-base font-semibold tracking-tight">
            Riwayat Latensi
          </CardTitle>
          <div className="flex gap-1.5">
            {RANGES.map((h) => (
              <button
                key={h}
                data-testid={`history-range-chip-${h}h`}
                data-selected={hours === h}
                onClick={() => setHours(h)}
                className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors duration-200 ease-out ${
                  hours === h
                    ? "border-sky-600 bg-sky-500/15 text-sky-300"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {h} jam
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {qHistory.isPending ? (
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          ) : qHistory.isError ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Gagal memuat riwayat ping.
            </p>
          ) : hist.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Belum ada data ping pada rentang ini.
            </p>
          ) : (
            <LatencyChart samples={hist} warnMs={warnMs} />
          )}
        </CardContent>
      </Card>

      {/* Log ping terakhir */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base font-semibold tracking-tight">
            Log Ping Terakhir
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada log.</p>
          ) : (
            <Table data-testid="device-ping-log-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Latensi</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((s) => (
                  <TableRow key={s.id} data-testid={`ping-log-row-${s.id}`}>
                    <TableCell className="font-mono text-xs">
                      {format(new Date(s.timestamp), "dd MMM HH:mm:ss", { locale: localeId })}
                    </TableCell>
                    <TableCell>
                      {s.ok ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-800/70 bg-[#064E3B] font-mono text-[11px] uppercase tracking-wider text-[#6EE7B7]"
                        >
                          Berhasil
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-red-900/70 bg-[#7F1D1D] font-mono text-[11px] uppercase tracking-wider text-[#FCA5A5]"
                        >
                          Timeout
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.latency_ms != null ? `${s.latency_ms.toFixed(1)} ms` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.error || "—"}</TableCell>
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
