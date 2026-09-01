"use client";

import Panel, { PanelHeading } from "./Panel";
import type { AircraftFilters } from "@/lib/iran-airspace/types";

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-[13px] text-slate-300">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[-1.125rem]" : "translate-x-[-0.125rem]"
          } right-0.5`}
        />
      </button>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block text-[11px] text-slate-400">
      <span className="mb-1 block">{label}</span>
      <input
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none"
      />
    </label>
  );
}

export default function FiltersPanel({
  filters,
  onChange,
}: {
  filters: AircraftFilters;
  onChange: (next: Partial<AircraftFilters>) => void;
}) {
  return (
    <Panel>
      <PanelHeading>פילטרים מהירים</PanelHeading>
      <div className="px-4 pb-1 pt-2">
        <Switch label="הצג מטוסים" checked={filters.showAircraft} onChange={(v) => onChange({ showAircraft: v })} />
        <Switch label="הצג מסלולי טיסה" checked={filters.showTrails} onChange={(v) => onChange({ showTrails: v })} />
        <Switch label="הצג Labels" checked={filters.showLabels} onChange={(v) => onChange({ showLabels: v })} />
        <Switch label="הצג מטוסים ללא Callsign" checked={filters.showNoCallsign} onChange={(v) => onChange({ showNoCallsign: v })} />
      </div>

      <div className="px-4 pb-1 pt-2">
        <Switch label="אזרחי" checked={filters.showCivil} onChange={(v) => onChange({ showCivil: v })} />
        <Switch label="צבאי" checked={filters.showMilitary} onChange={(v) => onChange({ showMilitary: v })} />
        <Switch label="תדלוק" checked={filters.showTanker} onChange={(v) => onChange({ showTanker: v })} />
        <Switch label="מודיעין / מעקב" checked={filters.showIntel} onChange={(v) => onChange({ showIntel: v })} />
      </div>

      <div className="mt-1 space-y-2.5 border-t border-white/5 p-4">
        <div className="text-[11px] font-bold text-slate-400">פילטרים מתקדמים</div>
        <TextField label="Callsign" value={filters.callsign} onChange={(v) => onChange({ callsign: v })} placeholder="לדוגמה: UAL123" />
        <TextField label="Registration" value={filters.registration} onChange={(v) => onChange({ registration: v })} placeholder="לדוגמה: N12345" />
        <TextField label="ICAO" value={filters.icao} onChange={(v) => onChange({ icao: v })} placeholder="hex" />
        <TextField label="Aircraft Type" value={filters.aircraftType} onChange={(v) => onChange({ aircraftType: v })} placeholder="לדוגמה: B738" />
        <div className="grid grid-cols-2 gap-2">
          <TextField label="גובה מינימלי (ft)" type="number" value={filters.minAltitude} onChange={(v) => onChange({ minAltitude: v })} />
          <TextField label="גובה מקסימלי (ft)" type="number" value={filters.maxAltitude} onChange={(v) => onChange({ maxAltitude: v })} />
        </div>
        <TextField label="מהירות מינימלית (kt)" type="number" value={filters.minSpeed} onChange={(v) => onChange({ minSpeed: v })} />
      </div>
    </Panel>
  );
}
