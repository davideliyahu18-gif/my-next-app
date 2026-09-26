"use client";

import { useState } from "react";
import Panel, { PanelHeading } from "./Panel";
import FlightBoard from "./FlightBoard";
import type { BgnFlight } from "@/lib/tlv-control/types";

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block text-[11px] text-slate-400">
      <span className="mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none"
      />
    </label>
  );
}

export default function FlightSearch({ emphasizeDate = false }: { emphasizeDate?: boolean }) {
  const [flightNumber, setFlightNumber] = useState("");
  const [destination, setDestination] = useState("");
  const [airline, setAirline] = useState("");
  const [date, setDate] = useState("");
  const [results, setResults] = useState<BgnFlight[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (flightNumber) params.set("flightNumber", flightNumber);
      if (destination) params.set("destination", destination);
      if (airline) params.set("airline", airline);
      if (date) params.set("date", date);
      const res = await fetch(`/api/tlv/flights?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok && (!data.flights || data.flights.length === 0)) {
        setError(data.error || "המקור אינו זמין כרגע");
        setResults([]);
      } else {
        setResults(data.flights ?? []);
      }
    } catch {
      setError("המקור אינו זמין כרגע");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Panel>
        <PanelHeading>{emphasizeDate ? "טיסות לפי תאריך" : "חיפוש טיסה"}</PanelHeading>
        <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-4">
          <Field label="מספר טיסה" value={flightNumber} onChange={setFlightNumber} />
          <Field label="יעד" value={destination} onChange={setDestination} />
          <Field label="חברת תעופה" value={airline} onChange={setAirline} />
          <Field label="תאריך" value={date} onChange={setDate} type="date" />
        </div>
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={search}
            disabled={loading}
            className="rounded-md bg-sky-500/20 px-4 py-2 text-[13px] font-bold text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
          >
            {loading ? "מחפש…" : "חפש"}
          </button>
          {error && <span className="mr-3 text-xs text-red-400">{error}</span>}
        </div>
      </Panel>

      {results !== null && (
        <FlightBoard title="תוצאות חיפוש" flights={results} emptyText="לא נמצאו טיסות תואמות" />
      )}
    </div>
  );
}
