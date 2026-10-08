"use client";

import Panel from "./Panel";
import { CATEGORY_COLORS, CATEGORY_LABELS_HE } from "@/lib/iran-airspace/constants";
import type { Aircraft, TrailPoint } from "@/lib/iran-airspace/types";

/** Small altitude-over-time trace from the recorded trail — no library, just
 * an inline polyline over the last N points. */
function AltitudeGraph({ trail, color }: { trail: TrailPoint[]; color: string }) {
  const points = trail.filter((p) => p.altitude != null).slice(-30);
  if (points.length < 2) {
    return <p className="text-[11px] text-slate-500">נצבור נתוני גובה עבור מטוס זה לאורך זמן.</p>;
  }
  const width = 260;
  const height = 48;
  const alts = points.map((p) => p.altitude as number);
  const max = Math.max(...alts, 1);
  const min = Math.min(...alts, 0);
  const span = Math.max(max - min, 1);
  const step = width / (points.length - 1);
  const path = points
    .map((p, i) => `${(i * step).toFixed(1)},${(height - (((p.altitude as number) - min) / span) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** No photo source exists for these aircraft (public ADS-B feeds don't
 * provide imagery) — a neutral top-down silhouette instead, never a
 * fabricated or mismatched photo. */
function SilhouettePlaceholder({ color }: { color: string }) {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
      <svg width="34" height="34" viewBox="0 0 24 24" style={{ filter: `drop-shadow(0 0 4px ${color}66)` }}>
        <path
          d="M21,16V14L13,9V3.5C13,2.67 12.33,2 11.5,2C10.67,2 10,2.67 10,3.5V9L2,14V16L10,13.5V19L7.5,20.5V22L11.5,21L15.5,22V20.5L13,19V13.5L21,16Z"
          fill={color}
          opacity="0.75"
        />
      </svg>
    </div>
  );
}

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
  following = false,
  onToggleFollow,
}: {
  aircraft: Aircraft | null;
  trail: TrailPoint[];
  onClose: () => void;
  following?: boolean;
  onToggleFollow?: () => void;
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
        <div className="mt-3 flex items-center gap-3">
          <SilhouettePlaceholder color={color} />
          {onToggleFollow && (
            <button
              type="button"
              onClick={onToggleFollow}
              className={`hamal-chip ${following ? "hamal-glow-cyan" : ""}`}
              data-active={following}
            >
              {following ? "🎯 עוקב…" : "🎯 עקוב"}
            </button>
          )}
        </div>

        <div className="mt-3 space-y-0.5">
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
          <h3 className="text-[12px] font-bold text-slate-300">גובה לאורך זמן</h3>
          <div className="mt-1.5">
            <AltitudeGraph trail={trail} color={color} />
          </div>
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
