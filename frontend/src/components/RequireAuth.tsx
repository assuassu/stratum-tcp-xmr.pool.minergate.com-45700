import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { RadioTower } from "lucide-react";
import { useMe } from "@/lib/useMe";

// Guards every authenticated route: splash while checking, /login when the session cookie is absent.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { data, isPending } = useMe();

  if (isPending) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <RadioTower className="h-8 w-8 animate-pulse text-sky-400" />
        <p className="font-mono text-xs uppercase tracking-[0.2em]">Memuat NOC…</p>
      </div>
    );
  }
  if (!data) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
