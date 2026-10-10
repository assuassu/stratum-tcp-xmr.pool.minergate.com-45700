import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RadioTower } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { apiErrorText } from "@/lib/errors";
import { beginSession } from "@/lib/session";
import { useMe } from "@/lib/useMe";
import type { AuthStatus, UserOut } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TELEMETRY = [
  { host: "OLT ZTE C320", ip: "10.10.10.2", ms: "1.2 ms", ok: true },
  { host: "Core MikroTik CCR2004", ip: "10.10.10.1", ms: "0.7 ms", ok: true },
  { host: "ONT ODP KMY-01", ip: "10.20.30.15", ms: "3.5 ms", ok: true },
  { host: "DNS Google", ip: "8.8.8.8", ms: "18.4 ms", ok: true },
  { host: "ONT ODP PLT-07", ip: "10.20.40.51", ms: "timeout", ok: false },
];

export default function Login() {
  const { data: user } = useMe();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState("");

  const statusQ = useQuery({
    queryKey: ["auth", "status"],
    queryFn: () => apiGet<AuthStatus>("/auth/status"),
    retry: false,
  });

  const onSuccess = async () => {
    beginSession();
    navigate("/", { replace: true });
  };

  const loginMut = useMutation({
    mutationFn: () => apiPost<UserOut>("/auth/login", { username, password }),
    onSuccess,
  });
  const setupMut = useMutation({
    mutationFn: () => apiPost<UserOut>("/auth/setup", { username, password }),
    onSuccess,
  });

  if (user) return <Navigate to="/" replace />;

  const setup = statusQ.data?.setup_required === true;
  const mut = setup ? setupMut : loginMut;
  const error = localError || (mut.isError ? apiErrorText(mut.error) : "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");
    if (setup && password !== confirm) {
      setLocalError("Konfirmasi password tidak sama");
      return;
    }
    mut.mutate();
  };

  return (
    <div data-testid="login-container" className="flex min-h-svh bg-background">
      {/* Panel branding + telemetri */}
      <div className="relative hidden flex-col justify-between border-r border-[#1E293B] bg-[#0D131F] p-10 md:flex lg:w-[45%]">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
              <RadioTower className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading text-lg font-semibold tracking-tight">FTTH Monitor</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                NOC Command Center
              </p>
            </div>
          </div>
          <h2 className="mt-12 max-w-md font-heading text-3xl font-semibold tracking-tight text-slate-100">
            Pantau jaringan FTTH Anda dalam satu panel kendali.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
            Status perangkat real-time, riwayat latensi, dan traceroute visual — berjalan di atas
            perintah sistem asli (<span className="font-mono">ping</span>,{" "}
            <span className="font-mono">traceroute</span>) pada LXC Ubuntu 24.04 Anda.
          </p>
        </div>

        <div className="space-y-2.5 rounded-xl border border-[#1F2937] bg-[#111827]/70 p-4 font-mono text-xs">
          {TELEMETRY.map((row) => (
            <div key={row.ip} className="flex items-center gap-3">
              <span
                className={`h-2 w-2 rounded-full ${
                  row.ok ? "beacon-dot bg-emerald-400" : "bg-red-400"
                }`}
              />
              <span className="w-44 truncate text-slate-200">{row.host}</span>
              <span className="text-slate-500">{row.ip}</span>
              <span className={`ml-auto ${row.ok ? "text-emerald-300" : "text-red-300"}`}>
                {row.ms}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Kartu kredensial */}
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md border-[#27354A] bg-card">
          <CardHeader>
            <CardTitle className="font-heading text-xl font-semibold tracking-tight">
              {setup ? "Setup Awal Admin" : "Masuk"}
            </CardTitle>
            <CardDescription>
              {setup
                ? "Buat akun administrator pertama untuk aplikasi ini."
                : "Masuk untuk mengakses dashboard monitoring."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="login-username">Username</Label>
                <Input
                  id="login-username"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  data-testid="login-username-input"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  required
                  autoComplete={setup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  data-testid="login-password-input"
                />
              </div>
              {setup && (
                <div className="grid gap-2">
                  <Label htmlFor="setup-confirm">Konfirmasi Password</Label>
                  <Input
                    id="setup-confirm"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    data-testid="setup-confirm-password-input"
                  />
                </div>
              )}

              {error && (
                <p data-testid="auth-error" className="rounded-md border border-red-900/60 bg-[#7F1D1D]/20 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={mut.isPending || statusQ.isPending}
                data-testid={setup ? "setup-button" : "login-button"}
              >
                {mut.isPending ? "Memproses…" : setup ? "Buat Akun Admin" : "Masuk"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
