"use client";

import Panel, { PanelHeading } from "./Panel";
import type { AircraftSnapshot, ConnectionState } from "@/lib/iran-airspace/types";

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
}: {
  snapshot: AircraftSnapshot | null;
  visibleCount: number;
  connection: ConnectionState;
}) {
  const stats = snapshot?.stats;

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
