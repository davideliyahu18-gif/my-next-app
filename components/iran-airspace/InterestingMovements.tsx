"use client";

import Panel, { PanelHeading } from "./Panel";
import { CATEGORY_COLORS } from "@/lib/iran-airspace/constants";
import type { Aircraft, InterestingMovement } from "@/lib/iran-airspace/types";

function PlaneGlyph({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0">
      <path
        d="M12 1.5 14.1 8.6 21.5 12 14.1 13.6 13 22 12 19.5 11 22 9.9 13.6 2.5 12 9.9 8.6 12 1.5Z"
        fill={color}
      />
    </svg>
  );
}

export default function InterestingMovements({
  movements,
  aircraftByHex,
  onSelect,
}: {
  movements: InterestingMovement[];
  aircraftByHex: Map<string, Aircraft>;
  onSelect: (hex: string) => void;
}) {
  const rows = movements
    .map((m) => ({ movement: m, aircraft: aircraftByHex.get(m.hex) }))
    .filter((r): r is { movement: InterestingMovement; aircraft: Aircraft } => Boolean(r.aircraft))
    .slice(0, 40);

  return (
    <Panel className="flex min-h-0 flex-1 flex-col">
      <PanelHeading>
        תנועות מעניינות עכשיו
        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold text-sky-300">
          {rows.length}
        </span>
      </PanelHeading>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {rows.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-slate-500">אין כרגע תנועות מסומנות</p>
        )}
        {rows.map(({ movement, aircraft }) => (
          <button
            key={movement.hex}
            type="button"
            onClick={() => onSelect(movement.hex)}
            className="block w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-right transition-colors hover:border-sky-400/30 hover:bg-white/[0.05]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <PlaneGlyph color={CATEGORY_COLORS[aircraft.category]} />
                <span className="truncate font-mono text-[13px] font-bold text-slate-100">
                  {aircraft.callsign || aircraft.hex.toUpperCase()}
                </span>
              </div>
              <span className="shrink-0 text-[11px] text-slate-500">{aircraft.aircraftType || "—"}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-400">
              {aircraft.registration && <span>{aircraft.registration}</span>}
              <span>{aircraft.altitude != null ? `${aircraft.altitude.toLocaleString("he-IL")} ft` : "—"}</span>
              <span>{aircraft.groundSpeed != null ? `${aircraft.groundSpeed} kt` : "—"}</span>
              <span>{aircraft.heading != null ? `${Math.round(aircraft.heading)}°` : "—"}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {movement.reasonLabels.map((label) => (
                <span key={label} className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                  {label}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </Panel>
  );
}
