import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PingSample } from "@/lib/types";

interface Point {
  t: number;
  latency_ms: number | null;
  ok: boolean;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-700 bg-[#0D131F] px-3 py-2 font-mono text-xs shadow-xl">
      <p className="text-slate-400">{format(new Date(p.t), "dd MMM HH:mm:ss", { locale: localeId })}</p>
      <p className={p.ok && p.latency_ms != null ? "mt-1 text-sky-400" : "mt-1 text-red-400"}>
        {p.ok && p.latency_ms != null ? `${p.latency_ms.toFixed(1)} ms` : "Timeout / tidak merespons"}
      </p>
    </div>
  );
}

export default function LatencyChart({ samples, warnMs }: { samples: PingSample[]; warnMs: number }) {
  const data: Point[] = samples.map((s) => ({
    t: new Date(s.timestamp).getTime(),
    latency_ms: s.latency_ms,
    ok: s.ok,
  }));

  return (
    <div data-testid="latency-chart" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="latencyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284C7" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#0284C7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => format(new Date(t), "HH:mm")}
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#1E293B" }}
            minTickGap={48}
          />
          <YAxis
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => `${v}ms`}
          />
          <Tooltip content={<ChartTooltip />} />
          {warnMs > 0 && <ReferenceLine y={warnMs} stroke="#FBBF24" strokeDasharray="4 4" />}
          <Area
            type="monotone"
            dataKey="latency_ms"
            stroke="#38BDF8"
            strokeWidth={1.5}
            fill="url(#latencyFill)"
            connectNulls={false}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
