"use client";

import Panel, { PanelHeading } from "./Panel";
import type { BgnFlight, FlightStatusTone } from "@/lib/tlv-control/types";

const TONE_STYLE: Record<FlightStatusTone, string> = {
  onTime: "bg-emerald-500/15 text-emerald-300",
  info: "bg-amber-500/15 text-amber-300",
  delayed: "bg-red-500/15 text-red-300",
  inProgress: "bg-sky-500/15 text-sky-300",
};

const TONE_LABEL: Record<FlightStatusTone, string> = {
  onTime: "בזמן",
  info: "עדכון",
  delayed: "עיכוב/ביטול",
  inProgress: "בתהליך",
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

function FlightRow({ flight }: { flight: BgnFlight }) {
  const otherAirport = flight.otherAirportNameHe || flight.otherAirportNameEn || flight.otherAirportCode || "—";
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/5 px-3 py-2.5 last:border-none sm:grid-cols-[90px_1fr_90px_70px_70px_110px]">
      <span className="font-mono text-[13px] font-bold text-slate-100">{flight.flightNumber}</span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-slate-200">{otherAirport}</div>
        <div className="truncate text-[11px] text-slate-500">{flight.airlineName}</div>
      </div>
      <span className="hidden font-mono text-[12px] text-slate-400 sm:block">{formatTime(flight.scheduledAt)}</span>
      <span className="hidden text-[12px] text-slate-400 sm:block">{flight.terminal || "—"}</span>
      <span className="hidden text-[12px] text-slate-400 sm:block">{flight.gate || "—"}</span>
      <span className={`shrink-0 justify-self-start rounded-full px-2 py-0.5 text-[11px] font-bold sm:justify-self-center ${TONE_STYLE[flight.statusTone]}`}>
        {TONE_LABEL[flight.statusTone]}
      </span>
    </div>
  );
}

export default function FlightBoard({
  title,
  flights,
  emptyText = "אין טיסות להצגה",
}: {
  title: string;
  flights: BgnFlight[];
  emptyText?: string;
}) {
  return (
    <Panel className="flex min-h-0 flex-1 flex-col">
      <PanelHeading>
        {title}
        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold text-sky-300">{flights.length}</span>
      </PanelHeading>
      <div className="hidden grid-cols-[90px_1fr_90px_70px_70px_110px] gap-3 border-b border-white/5 px-3 pb-2 pt-3 text-[11px] font-bold text-slate-500 sm:grid">
        <span>טיסה</span>
        <span>יעד/מוצא</span>
        <span>שעה</span>
        <span>טרמינל</span>
        <span>שער</span>
        <span className="text-center">סטטוס</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {flights.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-slate-500">{emptyText}</p>
        ) : (
          flights.map((f) => <FlightRow key={f.id} flight={f} />)
        )}
      </div>
    </Panel>
  );
}
