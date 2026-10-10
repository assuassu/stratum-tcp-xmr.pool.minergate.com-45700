import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPut } from "@/lib/api";
import { apiErrorText } from "@/lib/errors";
import type { AppSettings, SystemInfo } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Settings() {
  const qc = useQueryClient();

  const qSettings = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<AppSettings>("/settings"),
  });
  const qSystem = useQuery({
    queryKey: ["system"],
    queryFn: () => apiGet<SystemInfo>("/settings/system"),
  });

  const [interval, setInterval] = useState("30");
  const [warn, setWarn] = useState("100");
  const [timeout, setPingTimeout] = useState("2");

  useEffect(() => {
    if (qSettings.data) {
      setInterval(String(qSettings.data.ping_interval_s));
      setWarn(String(qSettings.data.latency_warn_ms));
      setPingTimeout(String(qSettings.data.ping_timeout_s));
    }
  }, [qSettings.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      apiPut<AppSettings>("/settings", {
        ping_interval_s: Number(interval) || 30,
        latency_warn_ms: Number(warn) || 100,
        ping_timeout_s: Number(timeout) || 2,
      }),
    onSuccess: (s) => {
      qc.setQueryData(["settings"], s);
      toast.success("Pengaturan disimpan");
    },
    onError: (err) => toast.error(apiErrorText(err)),
  });

  // Ganti password
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");

  const pwMut = useMutation({
    mutationFn: () =>
      apiPut("/auth/password", { current_password: curPw, new_password: newPw }),
    onSuccess: () => {
      toast.success("Password berhasil diganti");
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
    },
    onError: (err) => setPwError(apiErrorText(err)),
  });

  const submitPw = (e: FormEvent) => {
    e.preventDefault();
    setPwError("");
    if (newPw !== confirmPw) {
      setPwError("Konfirmasi password tidak sama");
      return;
    }
    pwMut.mutate();
  };

  const sys = qSystem.data;

  return (
    <div data-testid="settings-view" className="space-y-5">
      <div>
        <h2 className="font-heading text-lg font-semibold tracking-tight">Pengaturan Sistem</h2>
        <p className="text-sm text-muted-foreground">
          Konfigurasi ping worker latar belakang, keamanan akun, dan informasi server.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base font-semibold tracking-tight">
              Ping Worker
            </CardTitle>
            <CardDescription>
              Perubahan diterapkan pada siklus ping berikutnya tanpa perlu restart.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMut.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid gap-2">
                <Label htmlFor="settings-interval">Interval Ping (detik)</Label>
                <Input
                  id="settings-interval"
                  type="number"
                  min={5}
                  max={3600}
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  data-testid="settings-interval-input"
                />
                <p className="text-xs text-muted-foreground">5–3600 detik. Default 30 detik.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="settings-warn">Ambang Latensi Tinggi (ms)</Label>
                <Input
                  id="settings-warn"
                  type="number"
                  min={1}
                  max={10000}
                  value={warn}
                  onChange={(e) => setWarn(e.target.value)}
                  data-testid="settings-warn-input"
                />
                <p className="text-xs text-muted-foreground">
                  Latensi di atas nilai ini ditandai kuning pada dashboard.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="settings-timeout">Timeout Ping (detik)</Label>
                <Input
                  id="settings-timeout"
                  type="number"
                  min={1}
                  max={10}
                  value={timeout}
                  onChange={(e) => setPingTimeout(e.target.value)}
                  data-testid="settings-timeout-input"
                />
              </div>
              <Button
                type="submit"
                disabled={saveMut.isPending || qSettings.isPending}
                data-testid="settings-save-btn"
              >
                {saveMut.isPending ? "Menyimpan…" : "Simpan Pengaturan"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base font-semibold tracking-tight">
                Ganti Password Admin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitPw} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="pw-current">Password Saat Ini</Label>
                  <Input
                    id="pw-current"
                    type="password"
                    required
                    value={curPw}
                    onChange={(e) => setCurPw(e.target.value)}
                    data-testid="password-current-input"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="pw-new">Password Baru</Label>
                    <Input
                      id="pw-new"
                      type="password"
                      required
                      minLength={6}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      data-testid="password-new-input"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pw-confirm">Konfirmasi</Label>
                    <Input
                      id="pw-confirm"
                      type="password"
                      required
                      minLength={6}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      data-testid="password-confirm-input"
                    />
                  </div>
                </div>
                {pwError && (
                  <p data-testid="password-error" className="text-sm text-red-300">
                    {pwError}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="outline"
                  disabled={pwMut.isPending}
                  data-testid="password-change-btn"
                >
                  {pwMut.isPending ? "Menyimpan…" : "Ganti Password"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base font-semibold tracking-tight">
                Informasi Sistem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Hostname</span>
                <span>{sys?.hostname || "…"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Platform</span>
                <span>{sys?.platform || "…"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Perintah ping</span>
                <Badge
                  variant="outline"
                  data-testid="system-ping-badge"
                  className={
                    sys?.ping_available
                      ? "border-emerald-800/70 bg-[#064E3B] text-[#6EE7B7]"
                      : "border-red-900/70 bg-[#7F1D1D] text-[#FCA5A5]"
                  }
                >
                  {sys?.ping_available ? "Tersedia" : "Tidak ada"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Tool traceroute</span>
                <span>{sys?.traceroute_tool || "tidak ditemukan"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Monitor loop</span>
                <Badge
                  variant="outline"
                  data-testid="system-monitor-badge"
                  className={
                    sys?.monitor_running
                      ? "border-emerald-800/70 bg-[#064E3B] text-[#6EE7B7]"
                      : "border-amber-700 bg-[#78350F] text-[#FCD34D]"
                  }
                >
                  {sys?.monitor_running ? "Berjalan" : "Berhenti"}
                </Badge>
              </div>
              <div className="mt-3 rounded-md border border-[#27354A] bg-[#151E2E]/60 p-3 text-[11px] leading-relaxed text-slate-400">
                <p className="font-semibold text-slate-300">Catatan LXC Ubuntu 24.04</p>
                <p className="mt-1">
                  Install traceroute dengan <span className="text-sky-400">sudo apt install traceroute</span>.
                  Jika ping gagal dengan "Operation not permitted", beri kontainer kemampuan ICMP
                  (CAP_NET_RAW) atau set <span className="text-sky-400">net.ipv4.ping_group_range</span>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
