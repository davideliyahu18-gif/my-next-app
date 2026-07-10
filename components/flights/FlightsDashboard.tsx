"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { FlightDayScope, FlightRecord, FlightsSnapshot } from "@/lib/flights/types";
import { FLIGHTS_STREAM_INTERVAL_MS, FLIGHTS_TIMEZONE } from "@/lib/flights/constants";
import {
  dayScopeLabel,
  formatDelay,
  formatFlightDate,
  formatFlightDateTime,
  formatFlightTime,
  getIsraelDayKey,
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

function toneStyles(tone: ReturnType<typeof statusTone>) {
  switch (tone) {
    case "success":
      return {
        badge: "border-emerald-400/35 bg-emerald-500/15 text-emerald-200 shadow-[0_0_20px_rgba(52,211,153,0.15)]",
        rail: "bg-emerald-400",
      };
    case "warning":
      return {
        badge: "border-amber-400/35 bg-amber-500/15 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.12)]",
        rail: "bg-amber-400",
      };
    case "danger":
      return {
        badge: "border-rose-400/35 bg-rose-500/15 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.12)]",
        rail: "bg-rose-400",
      };
    case "muted":
      return {
        badge: "border-white/10 bg-white/5 text-zinc-400",
        rail: "bg-zinc-500",
      };
    default:
      return {
        badge: "border-sky-400/35 bg-sky-500/15 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.12)]",
        rail: "bg-sky-400",
      };
  }
}

function LiveClock() {
  const [now, setNow] = useState("");

  useEffect(() => {
    const tick = () => {
      setNow(
        new Intl.DateTimeFormat("he-IL", {
          timeZone: FLIGHTS_TIMEZONE,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden text-left sm:block">
      <p className="text-[10px] font-bold tracking-[0.2em] text-sky-300/70">
        שעון ישראל
      </p>
      <p className="font-mono text-lg font-bold text-white tabular-nums">{now || "—"}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
  icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent: string;
  icon: string;
}) {
  return (
    <div className="flights-glass group relative overflow-hidden rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
      <div
        className={`pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full blur-2xl ${accent}`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-sky-200/70">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black tracking-tight text-white">
            {value}
          </p>
          {hint ? <p className="mt-2 text-xs leading-relaxed text-slate-400">{hint}</p> : null}
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg">
          {icon}
        </span>
      </div>
    </div>
  );
}

function FlightSkeleton() {
  return (
    <div className="border-b border-white/[0.05] px-4 py-4 md:px-6">
      <div className="grid gap-3 md:grid-cols-[1.2fr_1.3fr_0.7fr_0.7fr_1fr] md:items-center">
        <div className="flights-skeleton h-10 rounded-xl" />
        <div className="flights-skeleton h-10 rounded-xl" />
        <div className="flights-skeleton h-10 rounded-xl" />
        <div className="flights-skeleton h-10 rounded-xl" />
        <div className="flights-skeleton h-10 rounded-xl" />
      </div>
    </div>
  );
}

function FlightRow({
  flight,
  showDate,
  direction,
}: {
  flight: FlightRecord;
  showDate?: boolean;
  direction: DirectionTab;
}) {
  const tone = statusTone(flight);
  const styles = toneStyles(tone);
  const delay = formatDelay(flight.delayMinutes);
  const city = flight.airportNameHe || flight.airportNameEn;
  const country = flight.countryHe || flight.countryEn;
  const isArrival = direction === "arrivals";

  return (
    <article className="group relative border-b border-white/[0.05] transition-colors hover:bg-white/[0.025]">
      <div className={`absolute inset-y-3 right-0 w-1 rounded-full ${styles.rail} opacity-80`} />
      <div className="grid gap-4 px-4 py-4 md:grid-cols-[1.2fr_1.3fr_0.7fr_0.7fr_1fr] md:items-center md:gap-5 md:px-6 md:py-5">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm ${
              isArrival
                ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                : "border-sky-400/25 bg-sky-500/10 text-sky-200"
            }`}
          >
            {isArrival ? "↓" : "↑"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-black tracking-wide text-white">
              {flight.flightCode}
            </p>
            <p className="truncate text-xs text-slate-400">
              {flight.airlineName}
              {showDate ? ` · ${formatFlightDate(flight.scheduledAt)}` : ""}
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="truncate text-base font-bold text-white">{city}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {flight.airportCode}
            {country ? ` · ${country}` : ""}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
          <p className="text-[10px] font-bold tracking-wider text-slate-500">מתוכנן</p>
          <p className="font-mono text-lg font-bold text-white tabular-nums">
            {formatFlightTime(flight.scheduledAt)}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
          <p className="text-[10px] font-bold tracking-wider text-slate-500">בפועל</p>
          <p
            className={`font-mono text-lg font-bold tabular-nums ${
              delay ? "text-amber-200" : "text-white"
            }`}
          >
            {formatFlightTime(flight.actualAt)}
          </p>
          {delay ? (
            <p className="mt-0.5 text-[11px] font-bold text-amber-300">{delay}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${styles.badge}`}
          >
            {flight.statusHe || flight.statusEn}
          </span>
          {flight.terminal ? (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-400">
              T{flight.terminal}
            </span>
          ) : null}
          {flight.direction === "departure" && flight.checkInCounters ? (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-400">
              דלפק {flight.checkInCounters}
            </span>
          ) : null}
        </div>
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

function SegmentButton({
  active,
  onClick,
  children,
  activeClassName,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  activeClassName: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2.5 text-sm font-bold transition-all ${
        active
          ? `${activeClassName} shadow-lg`
          : "border border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
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
  const todayKey = getIsraelDayKey();

  return (
    <div dir="rtl" className="flights-page relative min-h-screen overflow-x-hidden font-sans">
      <div className="flights-grid-bg pointer-events-none fixed inset-0" />
      <div className="flights-hero-glow pointer-events-none fixed inset-0" />

      <header className="relative z-20 border-b border-white/[0.08] bg-[#060d18]/75 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/20 to-cyan-400/5 text-xl shadow-[0_0_30px_rgba(56,189,248,0.2)]">
                ✈️
              </span>
              <span className="absolute -bottom-1 -left-1 rounded-md bg-[#0f172a] px-1.5 py-0.5 text-[10px] font-black tracking-wider text-sky-300 ring-1 ring-sky-400/30">
                TLV
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-[0.32em] text-sky-300/80">
                BEN GURION AIRPORT
              </p>
              <h1 className="text-flights-gradient text-2xl font-black md:text-3xl">
                לוח טיסות חי
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
            <LiveClock />
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                connected
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-400/30 bg-amber-500/10 text-amber-100"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connected ? "animate-live-pulse bg-emerald-400" : "bg-amber-300"
                }`}
              />
              {connected ? "LIVE" : "..."}
            </span>
            <Link
              href="/"
              className="hidden rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-sky-400/30 hover:text-white sm:inline-flex"
            >
              מונדיאל
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 border-b border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          <div className="flights-glass flights-scanline relative overflow-hidden rounded-3xl p-6 md:p-8">
            <div className="relative max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-sky-200">
                <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-sky-300" />
                OFFICIAL FEED · DATA.GOV.IL
              </p>
              <h2 className="mt-4 text-3xl font-black leading-tight text-white md:text-4xl">
                נתב״ג בזמן אמת
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400 md:text-base">
                נחיתות והמראות, עיכובים, טרמינלים ודלפקים — ישירות מרשות שדות
                התעופה. מעודכן אוטומטית כל 30 שניות.
              </p>
              <p className="mt-3 text-xs text-slate-500">
                היום: {formatFlightDate(`${todayKey}T12:00:00`)} · מקור רשמי
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 md:px-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={`נחיתות · ${dayLabel}`}
            value={snapshot.stats.arrivals}
            hint={`מתוך ${snapshot.catalogTotal.toLocaleString("he-IL")} במאגר המלא`}
            accent="bg-emerald-500/20"
            icon="🛬"
          />
          <StatCard
            label={`המראות · ${dayLabel}`}
            value={snapshot.stats.departures}
            hint="רשות שדות התעופה"
            accent="bg-sky-500/20"
            icon="🛫"
          />
          <StatCard
            label="עיכובים"
            value={snapshot.stats.delayed}
            hint={`${snapshot.stats.landed} נחתו · ${snapshot.stats.departed} המריאו`}
            accent="bg-amber-500/20"
            icon="⏱️"
          />
          <StatCard
            label="רענון"
            value={lastUpdated}
            hint={
              sourceUpdated
                ? `נתון מהרשות: ${sourceUpdated}`
                : "אוטומטי כל 30 שניות"
            }
            accent="bg-cyan-500/20"
            icon="🔄"
          />
        </section>

        {snapshot.error ? (
          <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            שגיאה זמנית: {snapshot.error}
          </div>
        ) : null}

        <section className="flights-glass sticky top-0 z-30 mt-8 rounded-3xl p-4 md:p-5">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["today", "היום"],
                ["tomorrow", "מחר"],
                ["yesterday", "אתמול"],
                ["all", "כל הימים"],
              ] as const
            ).map(([value, label]) => (
              <SegmentButton
                key={value}
                active={dayScope === value}
                onClick={() => setDayScope(value)}
                activeClassName="bg-gradient-to-l from-sky-500 to-cyan-400 text-white"
              >
                {label}
              </SegmentButton>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <SegmentButton
                active={tab === "arrivals"}
                onClick={() => setTab("arrivals")}
                activeClassName="bg-gradient-to-l from-emerald-500 to-teal-400 text-white"
              >
                נחיתות ({snapshot.stats.arrivals})
              </SegmentButton>
              <SegmentButton
                active={tab === "departures"}
                onClick={() => setTab("departures")}
                activeClassName="bg-gradient-to-l from-sky-500 to-blue-400 text-white"
              >
                המראות ({snapshot.stats.departures})
              </SegmentButton>
            </div>

            <div className="relative w-full xl:max-w-md">
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                ⌕
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="חיפוש טיסה, חברה, יעד..."
                className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 pl-4 pr-10 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/20"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
            {(
              [
                ["all", "הכל"],
                ["active", "פעילות"],
                ["delayed", "עיכובים"],
                ["canceled", "בוטלו"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === value
                    ? "bg-white/12 text-white ring-1 ring-white/15"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="flights-glass relative mt-5 overflow-hidden rounded-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.02] px-5 py-4">
            <div>
              <p className="text-sm font-bold text-white">
                {tab === "arrivals" ? "לוח נחיתות" : "לוח המראות"} · {dayLabel}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                מציג {visibleFlights.length} טיסות
                {snapshot.dayKey
                  ? ` · ${formatFlightDate(`${snapshot.dayKey}T12:00:00`)}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadFlights();
              }}
              className="rounded-full border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-100 transition hover:bg-sky-500/20"
            >
              רענון עכשיו
            </button>
          </div>

          <div className="hidden border-b border-white/[0.06] bg-black/20 px-6 py-3 text-[11px] font-bold tracking-[0.16em] text-slate-500 md:grid md:grid-cols-[1.2fr_1.3fr_0.7fr_0.7fr_1fr] md:gap-5">
            <span>טיסה</span>
            <span>{tab === "arrivals" ? "מוצא" : "יעד"}</span>
            <span>מתוכנן</span>
            <span>בפועל</span>
            <span>סטטוס</span>
          </div>

          <div className="max-h-[68vh] overflow-y-auto scrollbar-hide">
            {loading && snapshot.flights.length === 0 ? (
              <>
                <FlightSkeleton />
                <FlightSkeleton />
                <FlightSkeleton />
                <FlightSkeleton />
              </>
            ) : visibleFlights.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <p className="text-4xl">✈️</p>
                <p className="mt-4 text-sm text-slate-400">
                  {snapshot.flights.length === 0
                    ? `אין טיסות ליום ${dayLabel} במאגר.`
                    : "אין תוצאות לחיפוש או לסינון הנוכחי."}
                </p>
              </div>
            ) : (
              visibleFlights.map((flight) => (
                <FlightRow
                  key={flight.id}
                  flight={flight}
                  direction={tab}
                  showDate={dayScope === "all"}
                />
              ))
            )}
          </div>
        </section>

        <footer className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-center text-xs leading-relaxed text-slate-500">
          <p>
            מקור רשמי:{" "}
            <a
              href="https://data.gov.il/dataset/flydata"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sky-300 hover:underline"
            >
              data.gov.il · רשות שדות התעופה
            </a>
          </p>
          <p className="mt-2">
            הרשות מעדכנת כל ~15 דקות · האתר מרענן כל 30 שניות
          </p>
        </footer>
      </main>
    </div>
  );
}
