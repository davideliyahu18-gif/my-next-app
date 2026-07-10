"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FlightDayScope, FlightRecord, FlightsSnapshot } from "@/lib/flights/types";
import { FLIGHTS_STREAM_INTERVAL_MS } from "@/lib/flights/constants";
import {
  dayScopeLabel,
  formatDelay,
  formatFlightDate,
  formatFlightDateTime,
  formatFlightTime,
  matchesFlightQuery,
  statusTone,
} from "@/lib/flights/utils";

type DirectionTab = "arrivals" | "departures";
type StatusFilter = "all" | "delayed" | "active" | "canceled";

const EMPTY_SNAPSHOT: FlightsSnapshot = {
  ok: true,
  dayScope: "today",
  dayKey: null,
  catalogTotal: 0,
  flights: [],
  arrivals: [],
  departures: [],
  stats: {
    total: 0,
    arrivals: 0,
    departures: 0,
    delayed: 0,
    canceled: 0,
    landed: 0,
    departed: 0,
  },
  timestamp: new Date().toISOString(),
  sourceUpdatedAt: null,
  source: "data.gov.il",
};

function toneClasses(tone: ReturnType<typeof statusTone>) {
  switch (tone) {
    case "success":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
    case "warning":
      return "border-amber-400/30 bg-amber-500/10 text-amber-200";
    case "danger":
      return "border-rose-400/30 bg-rose-500/10 text-rose-200";
    case "muted":
      return "border-white/10 bg-white/5 text-zinc-400";
    default:
      return "border-sky-400/30 bg-sky-500/10 text-sky-200";
  }
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] font-bold tracking-[0.18em] text-sky-300/80">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function FlightRow({
  flight,
  showDate,
}: {
  flight: FlightRecord;
  showDate?: boolean;
}) {
  const tone = statusTone(flight);
  const delay = formatDelay(flight.delayMinutes);
  const city = flight.airportNameHe || flight.airportNameEn;
  const country = flight.countryHe || flight.countryEn;

  return (
    <article className="grid gap-3 border-b border-white/[0.06] px-4 py-4 transition-colors hover:bg-white/[0.02] md:grid-cols-[1.1fr_1.2fr_0.8fr_0.8fr_0.9fr] md:items-center md:gap-4 md:px-5">
      <div>
        <p className="text-lg font-black tracking-wide text-white">
          {flight.flightCode}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {flight.airlineName}
          {showDate ? ` · ${formatFlightDate(flight.scheduledAt)}` : ""}
        </p>
      </div>

      <div>
        <p className="font-bold text-white">{city}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {flight.airportCode}
          {country ? ` · ${country}` : ""}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-zinc-500">מתוכנן</p>
        <p className="font-mono text-base font-bold text-white">
          {formatFlightTime(flight.scheduledAt)}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-zinc-500">בפועל</p>
        <p className="font-mono text-base font-bold text-white">
          {formatFlightTime(flight.actualAt)}
        </p>
        {delay ? (
          <p className="mt-0.5 text-xs font-bold text-amber-300">{delay}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${toneClasses(tone)}`}
        >
          {flight.statusHe || flight.statusEn}
        </span>
        {flight.terminal ? (
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400">
            טרמינל {flight.terminal}
          </span>
        ) : null}
        {flight.direction === "departure" && flight.checkInCounters ? (
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400">
            דלפק {flight.checkInCounters}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function filterFlights(
  flights: FlightRecord[],
  statusFilter: StatusFilter,
): FlightRecord[] {
  if (statusFilter === "delayed") {
    return flights.filter((flight) => flight.isDelayed);
  }
  if (statusFilter === "canceled") {
    return flights.filter((flight) => flight.isCanceled);
  }
  if (statusFilter === "active") {
    return flights.filter((flight) =>
      /LANDED|נחתה|DEPARTED|המריא|LANDING|בנחיתה/i.test(
        `${flight.statusEn} ${flight.statusHe}`,
      ),
    );
  }
  return flights;
}

export function FlightsDashboard() {
  const [snapshot, setSnapshot] = useState<FlightsSnapshot>(EMPTY_SNAPSHOT);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dayScope, setDayScope] = useState<FlightDayScope>("today");
  const [tab, setTab] = useState<DirectionTab>("arrivals");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const loadFlights = useCallback(async () => {
    try {
      const response = await fetch(`/api/flights?day=${dayScope}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = (await response.json()) as FlightsSnapshot;
      setSnapshot(next);
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [dayScope]);

  useEffect(() => {
    setLoading(true);
    void loadFlights();
    const timer = setInterval(() => {
      void loadFlights();
    }, FLIGHTS_STREAM_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadFlights]);

  const visibleFlights = useMemo(() => {
    const base = tab === "arrivals" ? snapshot.arrivals : snapshot.departures;
    return filterFlights(base, statusFilter).filter((flight) =>
      matchesFlightQuery(flight, query),
    );
  }, [snapshot.arrivals, snapshot.departures, tab, statusFilter, query]);

  const lastUpdated = snapshot.timestamp
    ? formatFlightDateTime(snapshot.timestamp)
    : "—";

  const sourceUpdated = snapshot.sourceUpdatedAt
    ? formatFlightDateTime(snapshot.sourceUpdatedAt)
    : null;

  const dayLabel = dayScopeLabel(dayScope);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#030712] font-sans text-foreground"
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.14),transparent),radial-gradient(ellipse_50%_40%_at_100%_0%,rgba(14,165,233,0.08),transparent)]" />

      <header className="relative z-10 border-b border-white/[0.08] bg-[#030712]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500/10 text-xl shadow-[0_0_24px_rgba(56,189,248,0.18)]">
              ✈️
            </span>
            <div>
              <p className="text-[10px] font-bold tracking-[0.28em] text-sky-300">
                BEN GURION LIVE
              </p>
              <h1 className="text-xl font-black text-white md:text-2xl">
                נתב״ג · לוח טיסות חי
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold sm:inline-flex ${
                connected
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-400/30 bg-amber-500/10 text-amber-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connected ? "bg-emerald-400 animate-pulse" : "bg-amber-300"
                }`}
              />
              {connected ? "מתעדכן כל 30 שניות" : "מתחבר..."}
            </span>
            <Link
              href="/"
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300 transition-colors hover:border-sky-400/30 hover:text-white"
            >
              מונדיאל 2026
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-8">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={`נחיתות · ${dayLabel}`}
            value={snapshot.stats.arrivals}
            hint={`מתוך ${snapshot.catalogTotal} טיסות במאגר המלא`}
          />
          <StatCard
            label={`המראות · ${dayLabel}`}
            value={snapshot.stats.departures}
            hint="מקור רשמי — רשות שדות התעופה"
          />
          <StatCard
            label="עיכובים"
            value={snapshot.stats.delayed}
            hint="בסינון הנוכחי"
          />
          <StatCard
            label="רענון אתר"
            value={lastUpdated}
            hint={
              sourceUpdated
                ? `נתון אחרון מהרשות: ${sourceUpdated}`
                : "רענון אוטומטי כל 30 שניות"
            }
          />
        </section>

        {snapshot.error ? (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            שגיאה זמנית בשליפת נתונים: {snapshot.error}. מוצגים נתונים אחרונים אם
            קיימים.
          </div>
        ) : null}

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-5">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["today", "היום"],
                ["tomorrow", "מחר"],
                ["yesterday", "אתמול"],
                ["all", "כל הימים"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDayScope(value)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  dayScope === value
                    ? "bg-sky-500 text-white shadow-[0_8px_24px_rgba(14,165,233,0.35)]"
                    : "border border-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["arrivals", `נחיתות (${snapshot.stats.arrivals})`],
                  ["departures", `המראות (${snapshot.stats.departures})`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                    tab === value
                      ? "bg-sky-500 text-white shadow-[0_8px_24px_rgba(14,165,233,0.35)]"
                      : "border border-white/10 text-zinc-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="חיפוש לפי טיסה, חברה, יעד..."
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none ring-sky-400/40 placeholder:text-zinc-500 focus:ring-2 lg:max-w-sm"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ["all", "הכל"],
                ["active", "באוויר / נחתו"],
                ["delayed", "עיכובים"],
                ["canceled", "בוטלו"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  statusFilter === value
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-[#07101d]/80">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.02] px-5 py-3 text-xs text-zinc-500">
            <span>
              מציג {visibleFlights.length}{" "}
              {tab === "arrivals" ? "נחיתות" : "המראות"} · {dayLabel}
              {snapshot.dayKey ? ` (${formatFlightDate(`${snapshot.dayKey}T12:00:00`)})` : ""}
            </span>
            <button
              type="button"
              onClick={() => void loadFlights()}
              className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-zinc-300 hover:text-white"
            >
              רענון עכשיו
            </button>
          </div>
          <div className="hidden border-b border-white/[0.06] bg-white/[0.02] px-5 py-3 text-[11px] font-bold tracking-[0.16em] text-zinc-500 md:grid md:grid-cols-[1.1fr_1.2fr_0.8fr_0.8fr_0.9fr] md:gap-4">
            <span>טיסה</span>
            <span>{tab === "arrivals" ? "מוצא" : "יעד"}</span>
            <span>מתוכנן</span>
            <span>בפועל</span>
            <span>סטטוס</span>
          </div>

          {visibleFlights.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-zinc-500">
              {loading
                ? "טוען טיסות מהמקור הרשמי..."
                : snapshot.flights.length === 0
                  ? `אין טיסות ליום ${dayLabel} במאגר כרגע.`
                  : "אין טיסות שמתאימות לחיפוש או לסינון."}
            </div>
          ) : (
            visibleFlights.map((flight) => (
              <FlightRow
                key={flight.id}
                flight={flight}
                showDate={dayScope === "all"}
              />
            ))
          )}
        </section>

        <footer className="mt-8 text-center text-xs leading-relaxed text-zinc-600">
          <p>
            מקור:{" "}
            <a
              href="https://data.gov.il/dataset/flydata"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:underline"
            >
              data.gov.il · מאגר טיסות רשות שדות התעופה
            </a>
          </p>
          <p className="mt-1">
            הרשות מעדכנת את המאגר כל ~15 דקות · האתר מושך נתונים חדשים כל 30 שניות
          </p>
          <p className="mt-1">
            ברירת מחדל: טיסות של היום בלבד. לכלל הימים — לחצו &quot;כל הימים&quot;.
          </p>
        </footer>
      </main>
    </div>
  );
}
