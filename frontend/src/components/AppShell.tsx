import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, LogOut, Network, RadioTower, Route, Router, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { endSession } from "@/lib/session";
import { useMe } from "@/lib/useMe";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/devices", label: "Perangkat", icon: Router },
  { to: "/topologi", label: "Topologi", icon: Network },
  { to: "/traceroute", label: "Traceroute", icon: Route },
  { to: "/settings", label: "Pengaturan", icon: Settings },
];

const TITLES: Record<string, string> = {
  "/": "Dashboard NOC FTTH",
  "/devices": "Inventaris Perangkat",
  "/topologi": "Peta Topologi FTTH",
  "/traceroute": "Traceroute",
  "/settings": "Pengaturan",
};

export default function AppShell() {
  const { data: user } = useMe();
  const location = useLocation();

  const title =
    TITLES[location.pathname] ??
    (location.pathname.startsWith("/devices/") ? "Detail Perangkat" : "FTTH Monitor");

  return (
    <div className="min-h-svh bg-background">
      <aside
        data-testid="app-sidebar"
        className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r bg-sidebar md:flex"
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-sky-400">
            <RadioTower className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="font-heading text-sm font-semibold tracking-tight text-sidebar-foreground">
              FTTH Monitor
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              NOC Command Center
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={`nav-${to === "/" ? "dashboard" : to.slice(1)}`}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-200 ease-out ${
                  isActive
                    ? "bg-sidebar-accent font-medium text-sky-400"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-semibold text-sky-400">
              {(user?.username ?? "?").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm text-sidebar-foreground">{user?.username}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Administrator
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void endSession("/login")}
              data-testid="logout-button"
              aria-label="Keluar"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2.5 md:hidden">
            <RadioTower className="h-5 w-5 text-sky-400" />
            <span className="font-heading text-sm font-semibold">FTTH Monitor</span>
          </div>
          <h1
            data-testid="page-title"
            className="hidden font-heading text-base font-semibold tracking-tight md:block"
          >
            {title}
          </h1>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-800/60 bg-[#064E3B]/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-[#6EE7B7] sm:flex">
              <span className="beacon-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Monitor aktif
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => void endSession("/login")}
              data-testid="logout-button-mobile"
              aria-label="Keluar"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b bg-sidebar px-2 py-1.5 md:hidden">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={`nav-mobile-${to === "/" ? "dashboard" : to.slice(1)}`}
              className={({ isActive }) =>
                `flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition-colors duration-200 ease-out ${
                  isActive
                    ? "bg-sidebar-accent font-medium text-sky-400"
                    : "text-muted-foreground hover:text-sidebar-foreground"
                }`
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
