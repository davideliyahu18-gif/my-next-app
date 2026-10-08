"use client";

import Panel, { PanelHeading } from "./Panel";
import { CATEGORY_COLORS } from "@/lib/iran-airspace/constants";
import type { AircraftSnapshot, ConnectionState } from "@/lib/iran-airspace/types";

type StatsPoint = AircraftSnapshot["stats"];

/** Minimal inline sparkline — no charting library needed for a 20-30 point trend. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 72;
  const height = 22;
  if (values.length < 2) {
    return <svg width={width} height={height} aria-hidden />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}

/** Simple donut chart (stroke-dasharray trick) for the category breakdown —
 * no charting library needed for 4 fixed segments. */
function Donut({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const size = 76;
  const r = 30;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => {
              const frac = s.value / total;
              const dash = frac * circumference;
              const circle = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="9"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  opacity="0.9"
                />
              );
              offset += dash;
              return circle;
            })}
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-slate-100 text-[15px] font-extrabold">
          {total}
        </text>
      </svg>
      <div className="space-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
            <span className="font-mono text-slate-300">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function trendPct(values: number[]): number | null {
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  if (first === 0) return last === 0 ? 0 : null;
  return Math.round(((last - first) / first) * 100);
}

function TrendRow({ label, values, color }: { label: string; values: number[]; color: string }) {
  const pct = trendPct(values);
  const latest = values[values.length - 1] ?? 0;
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className="text-[11px] font-bold tabular-nums text-slate-200">{latest}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Sparkline values={values} color={color} />
        {pct != null && (
          <span className={`text-[10px] font-bold tabular-nums ${pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}%
          </span>
        )}
      </div>
    </div>
  );
}

function formatClock(iso: string | null): string {
  if (!iso) return "--:--:--";
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  connected: "מחובר",
  degraded: "מקור איטי",
  down: "אין חיבור",
};

const CONNECTION_DOT: Record<ConnectionState, string> = {
  connected: "bg-emerald-400",
  degraded: "bg-amber-400",
  down: "bg-red-500",
};

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`mt-0.5 text-xl font-extrabold tabular-nums ${accent ?? "text-slate-50"}`}>
        {value}
      </div>
    </div>
  );
}

export default function SystemStatus({
  snapshot,
  visibleCount,
  connection,
  history,
}: {
  snapshot: AircraftSnapshot | null;
  visibleCount: number;
  connection: ConnectionState;
  history?: StatsPoint[];
}) {
  const stats = snapshot?.stats;
  const h = history ?? [];
  const totalSeries = h.map((s) => s.total);
  const civilSeries = h.map((s) => s.civil);
  const militarySeries = h.map((s) => s.military);
  const tankerSeries = h.map((s) => s.tanker);
  const intelSeries = h.map((s) => s.intel);

  return (
    <Panel>
      <PanelHeading>סטטוס מערכת</PanelHeading>
      <div className="grid grid-cols-2 gap-2 p-3">
        <StatCard label="מטוסים בשידור חי" value={stats?.total ?? 0} accent="text-sky-300" />
        <StatCard label="מטוסים צבאיים / חשודים" value={(stats?.military ?? 0) + (stats?.tanker ?? 0) + (stats?.intel ?? 0)} accent="text-red-400" />
        <StatCard label="מטוסי תדלוק" value={stats?.tanker ?? 0} accent="text-orange-400" />
        <StatCard label="מטוסי מודיעין / מעקב" value={stats?.intel ?? 0} accent="text-purple-400" />
        <StatCard label="מטוסים אזרחיים" value={stats?.civil ?? 0} accent="text-blue-400" />
        <StatCard label="מטוסים בטווח המפה" value={visibleCount} />
        <StatCard label="עם Callsign" value={stats?.withCallsign ?? 0} />
        <StatCard label="עם Registration" value={stats?.withRegistration ?? 0} />
      </div>

      {stats && stats.total > 0 && (
        <div className="border-t border-white/5 px-3 py-2.5">
          <div className="mb-2 text-[11px] font-bold text-slate-400">התפלגות לפי סוג</div>
          <Donut
            segments={[
              { value: stats.civil, color: CATEGORY_COLORS.civil, label: "אזרחי" },
              { value: stats.military, color: CATEGORY_COLORS.military, label: "צבאי" },
              { value: stats.tanker, color: CATEGORY_COLORS.tanker, label: "תדלוק" },
              { value: stats.intel, color: CATEGORY_COLORS.intel, label: "מודיעין" },
            ]}
          />
        </div>
      )}

      {h.length >= 2 && (
        <div className="space-y-0.5 border-t border-white/5 px-3 py-2.5">
          <div className="mb-1 text-[11px] font-bold text-slate-400">מגמות פעילות (מאז פתיחת הדף)</div>
          <TrendRow label="סה״כ" values={totalSeries} color="#19c8ff" />
          <TrendRow label="אזרחי" values={civilSeries} color="#19c8ff" />
          <TrendRow label="צבאי" values={militarySeries} color="#ffb020" />
          <TrendRow label="תדלוק" values={tankerSeries} color="#ffb020" />
          <TrendRow label="מודיעין" values={intelSeries} color="#ffb020" />
        </div>
      )}

      <div className="space-y-2 border-t border-white/5 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">מקור נתונים</span>
          <span className="font-mono font-semibold text-slate-200">
            {snapshot?.source ?? "—"}
            {snapshot?.fellBackToSecondary ? " (חלופי)" : ""}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">זמן עדכון אחרון</span>
          <span className="font-mono font-semibold text-slate-200">
            {formatClock(snapshot?.timestamp ?? null)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">מצב חיבור</span>
          <span className="flex items-center gap-1.5 font-semibold text-slate-200">
            <span className={`h-2 w-2 rounded-full ${CONNECTION_DOT[connection]}`} />
            {CONNECTION_LABEL[connection]}
          </span>
        </div>
      </div>
    </Panel>
  );
}
