"use client";

import Panel from "./Panel";
import { CATEGORY_COLORS, CATEGORY_LABELS_HE } from "@/lib/iran-airspace/constants";
import type { Aircraft, TrailPoint } from "@/lib/iran-airspace/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-1.5 text-[13px] last:border-none">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono font-semibold text-slate-100">{value}</span>
    </div>
  );
}

function formatAltitude(v: number | null): string {
  if (v == null) return "—";
  return `${v.toLocaleString("he-IL")} ft`;
}

function formatVerticalRate(v: number | null): string {
  if (v == null) return "—";
  if (Math.abs(v) < 100) return "יציב";
  return `${v > 0 ? "+" : ""}${v.toLocaleString("he-IL")} ft/min`;
}

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export default function AircraftDetails({
  aircraft,
  trail,
  onClose,
}: {
  aircraft: Aircraft | null;
  trail: TrailPoint[];
  onClose: () => void;
}) {
  if (!aircraft) return null;
  const color = CATEGORY_COLORS[aircraft.category];

  return (
    <Panel className="flex max-h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate text-[15px] font-extrabold text-slate-50">
            {aircraft.callsign || aircraft.hex.toUpperCase()}
          </span>
          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
            {CATEGORY_LABELS_HE[aircraft.category]}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור"
          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-slate-100"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="mt-2 space-y-0.5">
          <Row label="Callsign" value={aircraft.callsign || "—"} />
          <Row label="Registration" value={aircraft.registration || "—"} />
          <Row label="Aircraft Type" value={aircraft.typeDescription || aircraft.aircraftType || "—"} />
          <Row label="ICAO" value={aircraft.hex.toUpperCase()} />
          <Row label="Operator" value={aircraft.operator || "—"} />
          <Row label="Country" value={aircraft.country || "—"} />
          <Row label="Altitude" value={aircraft.onGround ? "קרקע" : formatAltitude(aircraft.altitude)} />
          <Row label="Ground Speed" value={aircraft.groundSpeed != null ? `${aircraft.groundSpeed} kt` : "—"} />
          <Row label="Heading" value={aircraft.heading != null ? `${Math.round(aircraft.heading)}°` : "—"} />
          <Row label="Vertical Rate" value={formatVerticalRate(aircraft.verticalRate)} />
          <Row label="Squawk" value={aircraft.squawk || "—"} />
          <Row label="Coordinates" value={`${aircraft.lat.toFixed(3)}, ${aircraft.lon.toFixed(3)}`} />
          <Row label="Source" value={aircraft.source} />
          <Row label="Last Seen" value={formatClock(aircraft.lastSeen)} />
        </div>

        <div className="mt-4 border-t border-white/5 pt-3">
          <h3 className="text-[12px] font-bold text-slate-300">מסלול שנצפה</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            {trail.length >= 2
              ? `נרשמו ${trail.length} נקודות מיקום מאז פתיחת הדף — המסלול מוצג כקו על גבי המפה.`
              : "נצבור נקודות מיקום עבור מטוס זה כל עוד הדף פתוח, ונצייר מסלול היסטורי על המפה."}
          </p>
        </div>
      </div>
    </Panel>
  );
}
