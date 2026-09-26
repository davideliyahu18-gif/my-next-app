"use client";

import Panel, { PanelHeading } from "./Panel";
import type { Aircraft } from "@/lib/tlv-control/types";

export default function AircraftList({
  aircraft,
  onSelect,
}: {
  aircraft: Aircraft[];
  onSelect: (id: string) => void;
}) {
  return (
    <Panel className="flex min-h-0 flex-1 flex-col">
      <PanelHeading>
        🎯 מטוסים סביב נתב״ג
        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold text-sky-300">{aircraft.length}</span>
      </PanelHeading>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {aircraft.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-slate-500">אין מטוסים בטווח כרגע</p>
        ) : (
          aircraft.map((ac) => (
            <button
              key={ac.id}
              type="button"
              onClick={() => onSelect(ac.id)}
              className="mb-1 flex w-full items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-right text-[12px] transition-colors hover:border-sky-400/30 hover:bg-white/[0.05]"
            >
              <span className="font-mono font-bold text-slate-100">{ac.callsign || ac.registration || ac.id.toUpperCase()}</span>
              <span className="text-slate-500">{ac.aircraftType || "—"}</span>
              <span className="text-slate-400">{ac.onGround ? "קרקע" : ac.altitude != null ? `${ac.altitude.toLocaleString("he-IL")} ft` : "—"}</span>
              <span className="text-slate-400">{ac.groundSpeed != null ? `${ac.groundSpeed} kt` : "—"}</span>
            </button>
          ))
        )}
      </div>
    </Panel>
  );
}
