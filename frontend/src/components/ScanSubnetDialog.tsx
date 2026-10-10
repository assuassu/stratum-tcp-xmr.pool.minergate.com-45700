import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Radar } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { apiErrorText } from "@/lib/errors";
import type { ImportResult, ScanHit, ScanResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  knownHosts: string[];
  onImported: () => void;
}

export default function ScanSubnetDialog({ open, onOpenChange, knownHosts, onImported }: Props) {
  const [cidr, setCidr] = useState("192.168.1.0/24");
  const [timeoutS, setTimeoutS] = useState("1");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const scanMut = useMutation({
    mutationFn: (body: { cidr: string; timeout_s: number }) =>
      apiPost<ScanResult>("/devices/scan", body),
    onSuccess: (res) => {
      const known = new Set(knownHosts);
      const next: Record<string, boolean> = {};
      res.found.forEach((h) => {
        if (!known.has(h.ip)) next[h.ip] = true;
      });
      setSelected(next);
      if (res.error) toast.error(res.error);
      else toast.success(`${res.found.length} host aktif dari ${res.total_scanned} alamat`);
    },
    onError: (err) => toast.error(apiErrorText(err)),
  });

  const addMut = useMutation({
    mutationFn: (hits: ScanHit[]) =>
      apiPost<ImportResult>("/devices/import", {
        items: hits.map((h) => ({
          name: `Perangkat ${h.ip}`,
          host: h.ip,
          type: "other",
          location: "",
          pon_port: "",
          notes: `Ditemukan via pemindaian subnet (${h.method}${h.ports.length ? ` port ${h.ports.join("/")}` : ""})`,
          enabled: true,
          parent_id: "",
        })),
      }),
    onSuccess: (res) => {
      onImported();
      toast.success(`${res.created} perangkat ditambahkan ke inventaris`);
      onOpenChange(false);
    },
    onError: (err) => toast.error(apiErrorText(err)),
  });

  const run = (e: FormEvent) => {
    e.preventDefault();
    setSelected({});
    scanMut.mutate({ cidr, timeout_s: Number(timeoutS) || 1 });
  };

  const found = scanMut.data?.found ?? [];
  const known = new Set(knownHosts);
  const chosen = found.filter((h) => selected[h.ip]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="scan-subnet-dialog"
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Pindai Subnet</DialogTitle>
          <DialogDescription>
            Menyapu subnet dengan ping dan probe TCP (port 22/23/53/80/443/8080/8443/8291).
            Maksimum /24 — 256 alamat.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={run} className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="scan-cidr">Subnet (CIDR)</Label>
            <Input
              id="scan-cidr"
              required
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              placeholder="192.168.1.0/24"
              className="font-mono"
              data-testid="scan-cidr-input"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="scan-timeout">Timeout (detik)</Label>
            <Input
              id="scan-timeout"
              type="number"
              min={0.5}
              max={5}
              step={0.5}
              value={timeoutS}
              onChange={(e) => setTimeoutS(e.target.value)}
              data-testid="scan-timeout-input"
            />
          </div>
          <Button type="submit" disabled={scanMut.isPending} data-testid="scan-run-btn">
            <Radar className={`h-4 w-4 ${scanMut.isPending ? "animate-spin" : ""}`} />
            {scanMut.isPending ? "Memindai…" : "Mulai Pindai"}
          </Button>
        </form>

        {scanMut.isPending && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Menyapu <span className="font-mono text-sky-400">{cidr}</span> — mohon tunggu…
          </p>
        )}

        {scanMut.data?.error && (
          <p
            data-testid="scan-error"
            className="rounded-md border border-red-900/60 bg-[#7F1D1D]/20 px-3 py-2 text-sm text-red-300"
          >
            {scanMut.data.error}
          </p>
        )}

        {scanMut.data && !scanMut.data.error && (
          <div className="space-y-2" data-testid="scan-results">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="font-mono text-[11px]" data-testid="scan-found-count">
                {found.length} host aktif
              </Badge>
              <span className="font-mono">
                {scanMut.data.total_scanned} alamat dipindai · {(scanMut.data.duration_ms / 1000).toFixed(1)}s
              </span>
            </div>

            {found.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada host aktif ditemukan pada subnet ini.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-[#27354A]">
                {found.map((h) => {
                  const already = known.has(h.ip);
                  return (
                    <label
                      key={h.ip}
                      data-testid={`scan-hit-${h.ip}`}
                      className="flex items-center gap-3 border-b border-[#1F2937] px-3 py-2 text-xs last:border-0"
                    >
                      <Checkbox
                        checked={!already && selected[h.ip] === true}
                        disabled={already}
                        onCheckedChange={(c) => setSelected((s) => ({ ...s, [h.ip]: c === true }))}
                        data-testid={`scan-hit-checkbox-${h.ip}`}
                      />
                      <span className="w-32 shrink-0 font-mono text-slate-200">{h.ip}</span>
                      <Badge variant="outline" className="shrink-0 font-mono text-[10px] uppercase">
                        {h.method}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">
                        {h.latency_ms != null
                          ? `${h.latency_ms.toFixed(1)} ms`
                          : h.ports.length
                            ? `port ${h.ports.join(", ")}`
                            : ""}
                      </span>
                      {already && (
                        <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
                          sudah ada
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="scan-close-btn">
            Tutup
          </Button>
          <Button
            disabled={chosen.length === 0 || addMut.isPending}
            onClick={() => addMut.mutate(chosen)}
            data-testid="scan-add-selected-btn"
          >
            {addMut.isPending ? "Menambahkan…" : `Tambahkan ${chosen.length} Perangkat`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
