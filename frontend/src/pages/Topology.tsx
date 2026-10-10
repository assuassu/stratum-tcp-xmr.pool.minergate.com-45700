import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Network } from "lucide-react";
import { apiGet } from "@/lib/api";
import { DEVICE_TYPE_LABELS, type Device, type DeviceStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Node {
  device: Device;
  children: Node[];
}

// One rendered line of the tree: a device plus its depth and rolled-up segment health.
interface Row {
  device: Device;
  depth: number;
  childCount: number;
  segmentTotal: number;
  segmentDown: number;
  orphan: boolean;
}

function buildNodes(devices: Device[]): { roots: Node[]; orphans: Node[] } {
  const byId = new Map<string, Node>();
  devices.forEach((d) => byId.set(d.id, { device: d, children: [] }));

  const roots: Node[] = [];
  const orphans: Node[] = [];
  byId.forEach((node) => {
    const parentId = node.device.parent_id;
    if (!parentId) {
      roots.push(node);
      return;
    }
    const parent = byId.get(parentId);
    if (parent) parent.children.push(node);
    else orphans.push(node);
  });

  const byName = (a: Node, b: Node) => a.device.name.localeCompare(b.device.name);
  byId.forEach((n) => n.children.sort(byName));
  roots.sort(byName);
  orphans.sort(byName);
  return { roots, orphans };
}

// Iterative flatten (pre-order) — no self-recursive component, no recursion in render.
function flatten(roots: Node[], orphan: boolean): Row[] {
  const rows: Row[] = [];
  const stack: { node: Node; depth: number }[] = [...roots]
    .reverse()
    .map((node) => ({ node, depth: 0 }));

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    const { node, depth } = current;

    // Roll up this subtree's health with an explicit stack as well.
    let segmentTotal = 0;
    let segmentDown = 0;
    const walk: Node[] = [node];
    while (walk.length > 0) {
      const n = walk.pop();
      if (!n) break;
      segmentTotal += 1;
      if (n.device.enabled && n.device.last_status === "down") segmentDown += 1;
      n.children.forEach((c) => walk.push(c));
    }

    rows.push({
      device: node.device,
      depth,
      childCount: node.children.length,
      segmentTotal,
      segmentDown,
      orphan,
    });

    [...node.children].reverse().forEach((c) => stack.push({ node: c, depth: depth + 1 }));
  }
  return rows;
}

const DOT: Record<DeviceStatus, string> = {
  up: "bg-emerald-400",
  down: "bg-red-400",
  unknown: "bg-slate-500",
};

export default function Topology() {
  const qDevices = useQuery({
    queryKey: ["devices"],
    queryFn: () => apiGet<Device[]>("/devices"),
    refetchInterval: 30_000,
  });

  const devices = qDevices.data ?? [];
  const { roots, orphans } = buildNodes(devices);
  const rows = [...flatten(roots, false), ...flatten(orphans, true)];
  const downCount = devices.filter((d) => d.enabled && d.last_status === "down").length;
  const firstOrphanIndex = rows.findIndex((r) => r.orphan);

  return (
    <div data-testid="topology-view" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">Peta Topologi FTTH</h2>
          <p className="text-sm text-muted-foreground">
            Hierarki OLT → ODP → ONT dari relasi perangkat induk. Segmen bergangguan ditandai merah.
          </p>
        </div>
        <Badge
          variant="outline"
          data-testid="topology-health-badge"
          className={`font-mono text-[11px] uppercase tracking-wider ${
            downCount > 0
              ? "border-red-900/70 bg-[#7F1D1D] text-[#FCA5A5]"
              : "border-emerald-800/70 bg-[#064E3B] text-[#6EE7B7]"
          }`}
        >
          {downCount > 0 ? `${downCount} perangkat bergangguan` : "semua segmen sehat"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base font-semibold tracking-tight">
            Diagram Jaringan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {qDevices.isError ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Gagal memuat topologi — backend tidak terjangkau.
            </p>
          ) : qDevices.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Network className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Belum ada perangkat. Tambahkan perangkat lalu tetapkan "Perangkat Induk" untuk
                membentuk topologi.
              </p>
              <Link to="/devices" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Kelola Perangkat
              </Link>
            </div>
          ) : (
            rows.map((row, index) => {
              const d = row.device;
              const degraded = row.segmentDown > 0;
              return (
                <div key={d.id}>
                  {index === firstOrphanIndex && firstOrphanIndex > 0 && (
                    <p className="pb-2 pt-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      Induk tidak ditemukan
                    </p>
                  )}
                  <div
                    data-testid={`topology-node-${d.id}`}
                    style={{ marginLeft: `${row.depth * 28}px` }}
                    className={`relative flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-200 ease-out ${
                      d.enabled && d.last_status === "down"
                        ? "border-red-900/60 bg-[#7F1D1D]/20"
                        : "border-[#27354A] bg-[#151E2E]/60"
                    }`}
                  >
                    {row.depth > 0 && (
                      <ChevronRight className="absolute -left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
                    )}
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[d.last_status] ?? DOT.unknown} ${
                        d.last_status === "up" ? "beacon-dot" : ""
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/devices/${d.id}`}
                        className="truncate font-medium hover:text-sky-400"
                        data-testid={`topology-link-${d.id}`}
                      >
                        {d.name}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">
                        {d.host}
                        {d.location ? ` · ${d.location}` : ""}
                        {d.pon_port ? ` · ${d.pon_port}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 font-mono text-[10px] uppercase tracking-wider"
                    >
                      {DEVICE_TYPE_LABELS[d.type] ?? d.type}
                    </Badge>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {d.last_latency_ms != null ? `${d.last_latency_ms.toFixed(1)} ms` : "—"}
                    </span>
                    {row.childCount > 0 && (
                      <Badge
                        variant="outline"
                        data-testid={`topology-segment-badge-${d.id}`}
                        className={`shrink-0 font-mono text-[10px] uppercase tracking-wider ${
                          degraded
                            ? "border-red-900/70 bg-[#7F1D1D] text-[#FCA5A5]"
                            : "border-emerald-800/70 bg-[#064E3B] text-[#6EE7B7]"
                        }`}
                      >
                        {degraded
                          ? `${row.segmentDown}/${row.segmentTotal} gangguan`
                          : `segmen sehat · ${row.segmentTotal}`}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Tip: atur hierarki lewat kolom <span className="font-medium">Perangkat Induk</span> pada form
        edit perangkat — mis. ONT pelanggan berinduk ke OLT, dan OLT berinduk ke router core.
      </p>
    </div>
  );
}
