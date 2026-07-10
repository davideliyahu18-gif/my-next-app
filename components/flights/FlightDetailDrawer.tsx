"use client";

import { useEffect } from "react";
import type { FlightRecord } from "@/lib/flights/types";
import {
  formatDelay,
  formatFlightDate,
  formatFlightDateTime,
  formatFlightTime,
  statusTone,
} from "@/lib/flights/utils";

type FlightDetailDrawerProps = {
  flight: FlightRecord | null;
  open: boolean;
  tracked: boolean;
  onClose: () => void;
  onToggleTrack: (flightCode: string) => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3">
      <p className="text-[11px] font-bold tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

export function FlightDetailDrawer({
  flight,
  open,
  tracked,
  onClose,
  onToggleTrack,
}: FlightDetailDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !flight) return null;

  const isArrival = flight.direction === "arrival";
  const delay = formatDelay(flight.delayMinutes);
  const city = flight.airportNameHe || flight.airportNameEn;
  const tone = statusTone(flight);

  const toneClass =
    tone === "success"
      ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
      : tone === "warning"
        ? "border-amber-400/35 bg-amber-500/15 text-amber-100"
        : tone === "danger"
          ? "border-rose-400/35 bg-rose-500/15 text-rose-100"
          : "border-sky-400/35 bg-sky-500/15 text-sky-100";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="סגור"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div className="flights-glass relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-sky-300/80">
              מעקב טיסה
            </p>
            <h2 className="mt-1 text-3xl font-black text-white">{flight.flightCode}</h2>
            <p className="mt-1 text-sm text-slate-400">{flight.airlineName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div
          className={`mb-5 rounded-2xl border px-4 py-4 ${
            isArrival
              ? "border-emerald-400/20 bg-emerald-500/10"
              : "border-sky-400/20 bg-sky-500/10"
          }`}
        >
          <p className="text-xs font-bold text-slate-400">
            {isArrival ? "נחיתה בנתב״ג" : "המראה מנתב״ג"}
          </p>
          <p className="mt-2 text-xl font-black text-white">
            {isArrival ? `${city} → תל אביב (TLV)` : `תל אביב (TLV) → ${city}`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {flight.airportCode}
            {flight.countryHe ? ` · ${flight.countryHe}` : ""}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4 text-center">
            <p className="text-[11px] font-bold text-slate-500">מתוכנן</p>
            <p className="mt-2 font-mono text-2xl font-black text-white">
              {formatFlightTime(flight.scheduledAt)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {formatFlightDate(flight.scheduledAt)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4 text-center">
            <p className="text-[11px] font-bold text-slate-500">בפועל</p>
            <p
              className={`mt-2 font-mono text-2xl font-black ${
                delay ? "text-amber-200" : "text-white"
              }`}
            >
              {formatFlightTime(flight.actualAt)}
            </p>
            {delay ? (
              <p className="mt-1 text-xs font-bold text-amber-300">{delay}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">—</p>
            )}
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${toneClass}`}>
            {flight.statusHe || flight.statusEn}
          </span>
          {flight.terminal ? (
            <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300">
              טרמינל {flight.terminal}
            </span>
          ) : null}
          {flight.checkInZone ? (
            <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300">
              אזור {flight.checkInZone}
            </span>
          ) : null}
          {flight.checkInCounters ? (
            <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300">
              דלפק {flight.checkInCounters}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DetailRow label="תאריך מתוכנן" value={formatFlightDateTime(flight.scheduledAt)} />
          <DetailRow
            label="זמן בפועל"
            value={
              flight.actualAt
                ? formatFlightDateTime(flight.actualAt)
                : "טרם עודכן"
            }
          />
          <DetailRow label="סטטוס (EN)" value={flight.statusEn || "—"} />
          <DetailRow label="יעד/מוצא (EN)" value={flight.airportNameEn || "—"} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onToggleTrack(flight.flightCode)}
            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black transition ${
              tracked
                ? "border border-amber-400/30 bg-amber-500/15 text-amber-100"
                : "bg-gradient-to-l from-sky-500 to-cyan-400 text-white shadow-[0_10px_30px_rgba(56,189,248,0.25)]"
            }`}
          >
            {tracked ? "הסר ממעקב" : "עקוב אחרי טיסה"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 hover:text-white"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
