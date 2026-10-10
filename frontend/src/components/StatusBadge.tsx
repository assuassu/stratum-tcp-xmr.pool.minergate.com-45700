import { Badge } from "@/components/ui/badge";
import type { DeviceStatus } from "@/lib/types";

const STATUS_STYLES: Record<DeviceStatus, { label: string; className: string }> = {
  up: { label: "Online", className: "border-emerald-800/70 bg-[#064E3B] text-[#6EE7B7]" },
  down: { label: "Offline", className: "border-red-900/70 bg-[#7F1D1D] text-[#FCA5A5]" },
  unknown: { label: "Belum Dipantau", className: "border-slate-700 bg-slate-800 text-slate-300" },
};

export default function StatusBadge({ status, testId }: { status: DeviceStatus; testId?: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.unknown;
  return (
    <Badge
      variant="outline"
      data-testid={testId}
      className={`font-mono text-[11px] uppercase tracking-wider transition-colors duration-200 ease-out ${s.className}`}
    >
      {s.label}
    </Badge>
  );
}
