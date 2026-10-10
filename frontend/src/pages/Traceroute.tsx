import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Check, Copy, Globe, Route } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import type { TraceHop, TraceResult, TracerouteRequest } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function HopRow({ hop, index }: { hop: TraceHop; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25, ease: "easeOut" }}
      className="flex items-center gap-3 rounded-lg border border-[#27354A] bg-[#151E2E]/60 px-3 py-2.5"
      data-testid={`traceroute-hop-${hop.hop}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${
          hop.reached
            ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
            : "border-red-900/60 bg-[#7F1D1D]/40 text-red-300"
        }`}
      >
        {hop.hop}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm text-slate-200">
          {hop.reached ? hop.hostname || hop.ip || `Hop ${hop.hop}` : "* * *"}
        </p>
        {hop.reached && hop.hostname && hop.ip && hop.hostname !== hop.ip && (
          <p className="font-mono text-xs text-slate-500">{hop.ip}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        {hop.latencies_ms.length > 0 ? (
          hop.latencies_ms.map((ms, j) => (
            <Badge
              key={j}
              variant="outline"
              className={`font-mono text-[11px] ${
                ms >= 100
                  ? "border-amber-700 text-amber-300"
                  : "border-emerald-800 text-emerald-300"
              }`}
            >
              {ms.toFixed(1)} ms
            </Badge>
          ))
        ) : (
          <Badge variant="outline" className="border-red-900 font-mono text-[11px] text-red-300">
            Timeout
          </Badge>
        )}
      </div>
    </motion.div>
  );
}

export default function Traceroute() {
  const [host, setHost] = useState("8.8.8.8");
  const [maxHops, setMaxHops] = useState("15");
  const [timeoutS, setTimeoutS] = useState("2");
  const [copied, setCopied] = useState(false);

  const mut = useMutation({
    mutationFn: (req: TracerouteRequest) => apiPost<TraceResult>("/traceroute", req),
  });

  const run = (e: FormEvent) => {
    e.preventDefault();
    mut.mutate({ host, max_hops: Number(maxHops) || 15, timeout_s: Number(timeoutS) || 2 });
  };

  const copyRaw = async () => {
    if (!mut.data?.raw_output) return;
    try {
      await navigator.clipboard.writeText(mut.data.raw_output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin ke clipboard");
    }
  };

  return (
    <div data-testid="traceroute-view" className="space-y-5">
      <div>
        <h2 className="font-heading text-lg font-semibold tracking-tight">Visual Traceroute</h2>
        <p className="text-sm text-muted-foreground">
          Lacak rute paket dari server ke tujuan menggunakan perintah{" "}
          <span className="font-mono">traceroute</span> sistem asli.
        </p>
      </div>

      <Card>
        <CardContent className="py-4">
          <form onSubmit={run} className="grid gap-3 sm:grid-cols-[1fr_120px_120px_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="trace-host">Host / IP Tujuan</Label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="trace-host"
                  required
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="8.8.8.8 atau domain.com"
                  className="pl-9 font-mono"
                  data-testid="traceroute-host-input"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="trace-hops">Maks Hop</Label>
              <Input
                id="trace-hops"
                type="number"
                min={1}
                max={30}
                value={maxHops}
                onChange={(e) => setMaxHops(e.target.value)}
                data-testid="traceroute-max-hops-input"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="trace-timeout">Timeout (detik)</Label>
              <Input
                id="trace-timeout"
                type="number"
                min={0.5}
                max={10}
                step={0.5}
                value={timeoutS}
                onChange={(e) => setTimeoutS(e.target.value)}
                data-testid="traceroute-timeout-input"
              />
            </div>
            <Button type="submit" disabled={mut.isPending} data-testid="run-traceroute-btn">
              <Route className="h-4 w-4" />
              {mut.isPending ? "Menjalankan…" : "Jalankan Traceroute"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mut.isPending && (
        <div className="flex items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-10 text-sm text-muted-foreground">
          <Route className="h-4 w-4 animate-pulse text-sky-400" />
          Menelusuri rute ke <span className="font-mono text-sky-400">{host}</span> — dapat memakan
          waktu hingga ±1 menit…
        </div>
      )}

      {mut.isError && (
        <div
          data-testid="traceroute-error"
          className="rounded-lg border border-red-900/60 bg-[#7F1D1D]/20 px-4 py-3 text-sm text-red-200"
        >
          Traceroute gagal dijalankan — periksa koneksi ke backend.
        </div>
      )}

      {mut.data && mut.data.error && (
        <div
          data-testid="traceroute-error"
          className="rounded-lg border border-red-900/60 bg-[#7F1D1D]/20 px-4 py-3 text-sm text-red-200"
        >
          {mut.data.error}
        </div>
      )}

      {mut.data && !mut.data.error && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Alur hop visual */}
          <Card className="lg:col-span-7">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="font-heading text-base font-semibold tracking-tight" data-testid="traceroute-hops">
                Rute ke <span className="font-mono text-sky-400">{mut.data.target}</span>
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[11px] text-muted-foreground">
                {mut.data.hops.length} hop · {(mut.data.duration_ms / 1000).toFixed(1)}s
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {mut.data.hops.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Tidak ada hop yang terdeteksi.
                </p>
              ) : (
                mut.data.hops.map((h, i) => <HopRow key={h.hop} hop={h} index={i} />)
              )}
            </CardContent>
          </Card>

          {/* Log terminal mentah */}
          <Card className="lg:col-span-5">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="font-heading text-base font-semibold tracking-tight">
                Keluaran Terminal
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void copyRaw()}
                data-testid="copy-traceroute-btn"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copied ? "Tersalin" : "Salin"}
              </Button>
            </CardHeader>
            <CardContent>
              <pre
                data-testid="traceroute-raw-output"
                className="max-h-96 overflow-auto rounded-lg border border-[#1F2937] bg-[#050811] p-4 font-mono text-xs leading-relaxed text-[#38BDF8]"
              >
                {mut.data.raw_output || "(kosong)"}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
