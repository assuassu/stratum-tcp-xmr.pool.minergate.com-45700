import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Download, Pencil, Plus, Router as RouterIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { apiErrorText } from "@/lib/errors";
import { DEVICE_TYPE_LABELS, type Device, type DeviceCreate } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import DeviceFormDialog from "@/components/DeviceFormDialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Devices() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState<Device | null>(null);

  const qDevices = useQuery({
    queryKey: ["devices"],
    queryFn: () => apiGet<Device[]>("/devices"),
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["devices"] });
    qc.invalidateQueries({ queryKey: ["summary"] });
  };

  const createMut = useMutation({
    mutationFn: (values: DeviceCreate) => apiPost<Device>("/devices", values),
    onSuccess: (d) => {
      invalidate();
      setDialogOpen(false);
      toast.success(`Perangkat "${d.name}" ditambahkan`);
    },
    onError: (err) => toast.error(apiErrorText(err)),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, values }: { id: string; values: DeviceCreate }) =>
      apiPut<Device>(`/devices/${id}`, values),
    onSuccess: (d) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["device", d.id] });
      setDialogOpen(false);
      toast.success(`Perangkat "${d.name}" diperbarui`);
    },
    onError: (err) => toast.error(apiErrorText(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/devices/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast.success("Perangkat dihapus");
    },
    onError: (err) => toast.error(apiErrorText(err)),
  });

  const devices = qDevices.data ?? [];

  const exportCsv = () => {
    const header = ["nama", "host", "tipe", "lokasi", "port_pon", "status", "latensi_ms", "uptime_24h", "aktif"];
    const rows = devices.map((d) => [
      d.name,
      d.host,
      d.type,
      d.location,
      d.pon_port,
      d.last_status,
      d.last_latency_ms ?? "",
      d.uptime_24h ?? "",
      d.enabled ? "ya" : "tidak",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventaris-ftth.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div data-testid="devices-inventory-view" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">Inventaris Perangkat FTTH</h2>
          <p className="text-sm text-muted-foreground">
            Kelola daftar OLT, ONT/ONU, router, dan server yang dipantau.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} data-testid="devices-export-csv-btn">
            <Download className="h-4 w-4" /> Ekspor CSV
          </Button>
          <Button
            size="sm"
            data-testid="device-add-btn"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Tambah Perangkat
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          {qDevices.isError ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Gagal memuat inventaris — backend tidak terjangkau.
            </div>
          ) : qDevices.isPending ? (
            <div className="space-y-2 py-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <RouterIcon className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Belum ada perangkat. Tambahkan ONU/ONT, router, atau server pertama Anda.
              </p>
            </div>
          ) : (
            <Table data-testid="devices-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Perangkat</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="hidden md:table-cell">Lokasi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Monitoring</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((d) => (
                  <TableRow key={d.id} data-testid={`inventory-row-${d.id}`}>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link to={`/devices/${d.id}`} className="font-medium hover:text-sky-400">
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
                      <StatusBadge status={d.last_status} testId={`inventory-status-badge-${d.id}`} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant="outline"
                        data-testid={`inventory-enabled-badge-${d.id}`}
                        className={
                          d.enabled
                            ? "border-emerald-800/70 bg-[#064E3B]/50 text-[#6EE7B7]"
                            : "border-slate-700 bg-slate-800 text-slate-300"
                        }
                      >
                        {d.enabled ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${d.name}`}
                          data-testid={`device-edit-btn-${d.id}`}
                          onClick={() => {
                            setEditing(d);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-red-300 hover:text-red-200"
                          aria-label={`Hapus ${d.name}`}
                          data-testid={`device-delete-btn-${d.id}`}
                          onClick={() => setDeleting(d)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Link
                          to={`/devices/${d.id}`}
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          aria-label={`Detail ${d.name}`}
                          data-testid={`inventory-detail-btn-${d.id}`}
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

      <DeviceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        pending={createMut.isPending || updateMut.isPending}
        onSubmit={(values) => {
          if (editing) updateMut.mutate({ id: editing.id, values });
          else createMut.mutate(values);
        }}
      />

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent data-testid="device-delete-dialog" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus Perangkat?</DialogTitle>
            <DialogDescription>
              Perangkat <span className="font-semibold text-foreground">{deleting?.name}</span> beserta
              seluruh riwayat ping akan dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} data-testid="device-delete-cancel-btn">
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleting && deleteMut.mutate(deleting.id)}
              data-testid="device-delete-confirm-btn"
            >
              {deleteMut.isPending ? "Menghapus…" : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
