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
    <div className="rounded-xl border border-[#d6e4f0] bg-[#f5f8fc] px-4 py-3">
      <p className="text-[11px] font-bold tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#0b2d52]">{value}</p>
    </div>
  );
}

function toneBadgeClass(tone: ReturnType<typeof statusTone>) {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "danger":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "muted":
      return "border-slate-200 bg-slate-100 text-slate-600";
    default:
      return "border-sky-200 bg-sky-50 text-sky-900";
  }
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="סגור"
        onClick={onClose}
        className="absolute inset-0 bg-[#071d36]/60 backdrop-blur-sm"
      />

      <div className="flights-glass relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#1565c0]">
              מעקב טיסה
            </p>
            <h2 className="mt-1 text-3xl font-black text-[#0b2d52]">{flight.flightCode}</h2>
            <p className="mt-1 text-sm text-slate-500">{flight.airlineName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#d6e4f0] bg-white px-3 py-1.5 text-sm text-slate-500 transition hover:border-[#1565c0]/30 hover:text-[#0b2d52]"
          >
            ✕
          </button>
        </div>

        <div
          className={`mb-5 rounded-xl border px-4 py-4 ${
            isArrival
              ? "border-emerald-200 bg-emerald-50"
              : "border-sky-200 bg-sky-50"
          }`}
        >
          <p className="text-xs font-bold text-slate-500">
            {isArrival ? "נחיתה בנתב״ג" : "המראה מנתב״ג"}
          </p>
          <p className="mt-2 text-xl font-black text-[#0b2d52]">
            {isArrival ? `${city} → תל אביב (TLV)` : `תל אביב (TLV) → ${city}`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {flight.airportCode}
            {flight.countryHe ? ` · ${flight.countryHe}` : ""}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#d6e4f0] bg-white p-4 text-center">
            <p className="text-[11px] font-bold text-slate-500">מתוכנן</p>
            <p className="mt-2 font-mono text-2xl font-black text-[#0b2d52]">
              {formatFlightTime(flight.scheduledAt)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {formatFlightDate(flight.scheduledAt)}
            </p>
          </div>
          <div className="rounded-xl border border-[#d6e4f0] bg-white p-4 text-center">
            <p className="text-[11px] font-bold text-slate-500">בפועל</p>
            <p
              className={`mt-2 font-mono text-2xl font-black ${
                delay ? "text-amber-700" : "text-[#0b2d52]"
              }`}
            >
              {formatFlightTime(flight.actualAt)}
            </p>
            {delay ? (
              <p className="mt-1 text-xs font-bold text-amber-600">{delay}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">—</p>
            )}
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${toneBadgeClass(tone)}`}
          >
            {flight.statusHe || flight.statusEn}
          </span>
          {flight.terminal ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
              טרמינל {flight.terminal}
            </span>
          ) : null}
          {flight.checkInZone ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
              אזור {flight.checkInZone}
            </span>
          ) : null}
          {flight.checkInCounters ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
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
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-black transition ${
              tracked
                ? "border border-amber-200 bg-amber-50 text-amber-800"
                : "bg-[#1565c0] text-white shadow-[0_8px_24px_rgba(21,101,192,0.25)] hover:bg-[#0b2d52]"
            }`}
          >
            {tracked ? "הסר ממעקב" : "עקוב אחרי טיסה"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#d6e4f0] bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:border-[#1565c0]/30 hover:text-[#0b2d52]"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
