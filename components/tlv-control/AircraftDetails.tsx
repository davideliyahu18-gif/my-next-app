"use client";

import Panel from "./Panel";
import type { Aircraft } from "@/lib/tlv-control/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-1.5 text-[13px] last:border-none">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono font-semibold text-slate-100">{value}</span>
    </div>
  );
}

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso));
}

export default function AircraftDetails({ aircraft, onClose }: { aircraft: Aircraft | null; onClose: () => void }) {
  if (!aircraft) return null;

  return (
    <Panel className="flex max-h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <span className="truncate text-[15px] font-extrabold text-slate-50">
          {aircraft.callsign || aircraft.registration || aircraft.id.toUpperCase()}
        </span>
        <button type="button" onClick={onClose} aria-label="סגור" className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-slate-100">
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="mt-2 space-y-0.5">
          <Row label="Callsign" value={aircraft.callsign || "—"} />
          <Row label="Registration" value={aircraft.registration || "—"} />
          <Row label="Aircraft Type" value={aircraft.aircraftType || "—"} />
          <Row label="ICAO" value={aircraft.id.toUpperCase()} />
          <Row label="Altitude" value={aircraft.onGround ? "קרקע" : aircraft.altitude != null ? `${aircraft.altitude.toLocaleString("he-IL")} ft` : "—"} />
          <Row label="Ground Speed" value={aircraft.groundSpeed != null ? `${aircraft.groundSpeed} kt` : "—"} />
          <Row label="Heading" value={aircraft.heading != null ? `${Math.round(aircraft.heading)}°` : "—"} />
          <Row label="Vertical Rate" value={aircraft.verticalRate != null ? `${aircraft.verticalRate > 0 ? "+" : ""}${aircraft.verticalRate} ft/min` : "—"} />
          <Row label="Squawk" value={aircraft.squawk || "—"} />
          <Row label="Coordinates" value={`${aircraft.latitude.toFixed(3)}, ${aircraft.longitude.toFixed(3)}`} />
          <Row label="מקור" value={aircraft.source} />
          <Row label="עדכון אחרון" value={formatClock(aircraft.lastSeen)} />
        </div>
      </div>
    </Panel>
  );
}
