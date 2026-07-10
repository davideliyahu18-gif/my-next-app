"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { FlightDetailDrawer } from "@/components/flights/FlightDetailDrawer";
import { useTrackedFlights } from "@/hooks/useTrackedFlights";
import type { FlightDayScope, FlightRecord, FlightsSnapshot } from "@/lib/flights/types";
import {
  FLIGHTS_HERO_IMAGE,
  FLIGHTS_IAA,
  FLIGHTS_STREAM_INTERVAL_MS,
  FLIGHTS_TIMEZONE,
} from "@/lib/flights/constants";
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
        badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
        rail: "bg-emerald-500",
      };
    case "warning":
      return {
        badge: "border-amber-200 bg-amber-50 text-amber-900",
        rail: "bg-amber-500",
      };
    case "danger":
      return {
        badge: "border-rose-200 bg-rose-50 text-rose-800",
        rail: "bg-rose-500",
      };
    case "muted":
      return {
        badge: "border-slate-200 bg-slate-100 text-slate-600",
        rail: "bg-slate-400",
      };
    default:
      return {
        badge: "border-sky-200 bg-sky-50 text-sky-900",
        rail: "bg-sky-500",
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
      <p className="text-[10px] font-bold tracking-[0.2em] text-slate-500">
        שעון ישראל
      </p>
      <p className="font-mono text-lg font-bold text-[#0b2d52] tabular-nums">{now || "—"}</p>
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
    <div className="flights-glass group relative overflow-hidden rounded-xl p-5 transition-shadow hover:shadow-lg">
      <div
        className={`pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-60 ${accent}`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black tracking-tight text-[#0b2d52]">
            {value}
          </p>
          {hint ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d6e4f0] bg-[#e3f2fd] text-lg">
          {icon}
        </span>
      </div>
    </div>
  );
}

function FlightSkeleton() {
  return (
    <div className="border-b border-[#d6e4f0] px-4 py-4 md:px-6">
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
  onSelect,
  isTracked,
  isSelected,
}: {
  flight: FlightRecord;
  showDate?: boolean;
  direction: DirectionTab;
  onSelect: (flight: FlightRecord) => void;
  isTracked?: boolean;
  isSelected?: boolean;
}) {
  const tone = statusTone(flight);
  const styles = toneStyles(tone);
  const delay = formatDelay(flight.delayMinutes);
  const city = flight.airportNameHe || flight.airportNameEn;
  const country = flight.countryHe || flight.countryEn;
  const isArrival = direction === "arrivals";

  return (
    <button
      type="button"
      onClick={() => onSelect(flight)}
      className={`flights-row-alt group relative w-full border-b border-[#d6e4f0] text-right transition-colors ${
        isSelected ? "bg-sky-50 ring-1 ring-inset ring-sky-200" : ""
      } ${isTracked ? "ring-1 ring-inset ring-amber-200" : ""}`}
    >
      <div className={`absolute inset-y-3 right-0 w-1 rounded-full ${styles.rail} opacity-80`} />
      <div className="grid gap-4 px-4 py-4 md:grid-cols-[1.2fr_1.3fr_0.7fr_0.7fr_1fr] md:items-center md:gap-5 md:px-6 md:py-5">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm ${
              isArrival
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-sky-200 bg-sky-50 text-sky-700"
            }`}
          >
            {isArrival ? "↓" : "↑"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-black tracking-wide text-[#0b2d52]">
              {flight.flightCode}
              {isTracked ? (
                <span className="mr-2 text-[10px] font-bold text-amber-600">★</span>
              ) : null}
            </p>
            <p className="truncate text-xs text-slate-500">
              {flight.airlineName}
              {showDate ? ` · ${formatFlightDate(flight.scheduledAt)}` : ""}
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-800">{city}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {flight.airportCode}
            {country ? ` · ${country}` : ""}
          </p>
        </div>

        <div className="rounded-lg border border-[#d6e4f0] bg-white px-3 py-2">
          <p className="text-[10px] font-bold tracking-wider text-slate-500">מתוכנן</p>
          <p className="font-mono text-lg font-bold text-[#0b2d52] tabular-nums">
            {formatFlightTime(flight.scheduledAt)}
          </p>
        </div>

        <div className="rounded-lg border border-[#d6e4f0] bg-white px-3 py-2">
          <p className="text-[10px] font-bold tracking-wider text-slate-500">בפועל</p>
          <p
            className={`font-mono text-lg font-bold tabular-nums ${
              delay ? "text-amber-700" : "text-[#0b2d52]"
            }`}
          >
            {formatFlightTime(flight.actualAt)}
          </p>
          {delay ? (
            <p className="mt-0.5 text-[11px] font-bold text-amber-600">{delay}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${styles.badge}`}
          >
            {flight.statusHe || flight.statusEn}
          </span>
          {flight.terminal ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
              T{flight.terminal}
            </span>
          ) : null}
          {flight.direction === "departure" && flight.checkInCounters ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
              דלפק {flight.checkInCounters}
            </span>
          ) : null}
          <span className="text-[10px] text-[#1565c0] opacity-0 transition group-hover:opacity-100">
            פרטים ←
          </span>
        </div>
      </div>
    </button>
  );
}

function TrackedFlightChip({
  flight,
  onSelect,
}: {
  flight: FlightRecord;
  onSelect: (flight: FlightRecord) => void;
}) {
  const delay = formatDelay(flight.delayMinutes);
  return (
    <button
      type="button"
      onClick={() => onSelect(flight)}
      className="flights-glass min-w-[220px] flex-1 rounded-xl p-4 text-right transition hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-black text-[#0b2d52]">{flight.flightCode}</span>
        <span className="text-[10px] font-bold text-amber-600">במעקב</span>
      </div>
      <p className="mt-1 truncate text-xs text-slate-400">
        {flight.airportNameHe || flight.airportNameEn}
      </p>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="font-mono text-[#0b2d52]">{formatFlightTime(flight.actualAt || flight.scheduledAt)}</span>
        <span className="font-bold text-[#1565c0]">{flight.statusHe}</span>
      </div>
      {delay ? <p className="mt-1 text-[11px] font-bold text-amber-600">{delay}</p> : null}
    </button>
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
      className={`rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${
        active
          ? `${activeClassName} shadow-md`
          : "border border-[#d6e4f0] bg-white text-slate-600 hover:border-[#1565c0]/40 hover:text-[#0b2d52]"
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
  const [selectedFlight, setSelectedFlight] = useState<FlightRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [pollCount, setPollCount] = useState(0);

  const {
    trackedFlights,
    isTracked,
    toggleTrack,
    refreshTracked,
  } = useTrackedFlights();

  const openFlightDetail = useCallback((flight: FlightRecord) => {
    setSelectedFlight(flight);
    setDetailOpen(true);
  }, []);

  const closeFlightDetail = useCallback(() => {
    setDetailOpen(false);
  }, []);

  const loadFlights = useCallback(
    async ({ showLoading = false, force = false }: { showLoading?: boolean; force?: boolean } = {}) => {
      if (showLoading) setLoading(true);
      try {
        const response = await fetch(
          `/api/flights?day=${dayScope}${force ? "&refresh=1" : ""}&_=${Date.now()}`,
          { cache: "no-store", headers: { Pragma: "no-cache" } },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next = (await response.json()) as FlightsSnapshot;
        setSnapshot(next);
        setConnected(true);
        setPollCount((count) => count + 1);
      } catch {
        setConnected(false);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [dayScope],
  );

  useEffect(() => {
    void loadFlights({ showLoading: true, force: true });
    void refreshTracked();

    const timer = setInterval(() => {
      void loadFlights({ force: true });
      void refreshTracked();
    }, FLIGHTS_STREAM_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadFlights({ force: true });
        void refreshTracked();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [dayScope, loadFlights, refreshTracked]);

  useEffect(() => {
    if (!snapshot.timestamp) return;
    const tick = () => {
      const age = Math.max(
        0,
        Math.floor((Date.now() - new Date(snapshot.timestamp).getTime()) / 1000),
      );
      setSecondsSinceUpdate(age);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [snapshot.timestamp]);

  useEffect(() => {
    if (!selectedFlight) return;
    const updated =
      snapshot.flights.find((flight) => flight.id === selectedFlight.id) ??
      trackedFlights.find((flight) => flight.id === selectedFlight.id) ??
      snapshot.flights.find(
        (flight) => flight.flightCode === selectedFlight.flightCode,
      );
    if (updated && updated.id !== selectedFlight.id) {
      setSelectedFlight(updated);
    } else if (
      updated &&
      (updated.statusHe !== selectedFlight.statusHe ||
        updated.actualAt !== selectedFlight.actualAt)
    ) {
      setSelectedFlight(updated);
    }
  }, [snapshot.flights, trackedFlights, selectedFlight]);

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
      <header className="flights-iaa-header relative z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg text-white shadow-md"
              style={{ background: `linear-gradient(135deg, ${FLIGHTS_IAA.navy}, ${FLIGHTS_IAA.blue})` }}
            >
              <span className="text-lg font-black">TLV</span>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-[0.22em] text-slate-500">
                רשות שדות התעופה
              </p>
              <h1 className="text-flights-gradient text-xl font-black md:text-2xl">
                נמל התעופה בן גוריון
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
            <LiveClock />
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                connected
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connected ? "animate-live-pulse bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {connected ? `עדכון · ${secondsSinceUpdate}ש׳` : "..."}
            </span>
            <Link
              href="/"
              className="hidden rounded-lg border border-[#d6e4f0] bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-[#1565c0]/40 hover:text-[#0b2d52] sm:inline-flex"
            >
              מונדיאל
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 overflow-hidden">
        <div className="relative min-h-[52vh] md:min-h-[58vh]">
          <Image
            src={FLIGHTS_HERO_IMAGE}
            alt="נמל התעופה בן גוריון טרמינל 3 בלילה"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071d36]/95 via-[#0b2d52]/72 to-[#0b2d52]/45" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#071d36]/80 via-transparent to-[#071d36]/55" />

          <div className="relative mx-auto flex min-h-[52vh] max-w-7xl flex-col justify-end px-4 pb-10 pt-20 md:min-h-[58vh] md:px-8 md:pb-14">
            <span className="inline-flex w-fit items-center gap-2 rounded-md bg-white/15 px-3 py-1.5 text-xs font-black tracking-wide text-white ring-1 ring-white/25 backdrop-blur-sm">
              טרמינל 3 · נתב״ג
            </span>
            <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">
              נמל התעופה בן גוריון שלכם ובשבילכם
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-sky-100 md:text-base">
              לוח טיסות חי — נחיתות והמראות, עיכובים ומעקב אחרי טיסה. מקור רשמי:
              data.gov.il
            </p>

            <div className="mt-8 flex flex-wrap gap-0 overflow-hidden rounded-t-xl border border-white/20 bg-white/95 shadow-2xl backdrop-blur-md">
              <button
                type="button"
                onClick={() => setTab("arrivals")}
                className={`flights-iaa-tab flex-1 sm:flex-none ${
                  tab === "arrivals" ? "flights-iaa-tab-active" : ""
                }`}
              >
                נחיתות ({snapshot.stats.arrivals})
              </button>
              <button
                type="button"
                onClick={() => setTab("departures")}
                className={`flights-iaa-tab flex-1 sm:flex-none ${
                  tab === "departures" ? "flights-iaa-tab-active" : ""
                }`}
              >
                המראות ({snapshot.stats.departures})
              </button>
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
            accent="bg-sky-100"
            icon="🛬"
          />
          <StatCard
            label={`המראות · ${dayLabel}`}
            value={snapshot.stats.departures}
            hint="רשות שדות התעופה"
            accent="bg-blue-100"
            icon="🛫"
          />
          <StatCard
            label="עיכובים"
            value={snapshot.stats.delayed}
            hint={`${snapshot.stats.landed} נחתו · ${snapshot.stats.departed} המריאו`}
            accent="bg-amber-100"
            icon="⏱️"
          />
          <StatCard
            label="רענון"
            value={connected ? `לפני ${secondsSinceUpdate}ש׳` : "—"}
            hint={
              sourceUpdated
                ? `רשות: ${sourceUpdated} · סריקות: ${pollCount}`
                : `אוטומטי כל 30 שניות · ${lastUpdated}`
            }
            accent="bg-cyan-100"
            icon="🔄"
          />
        </section>

        {snapshot.error ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            שגיאה זמנית: {snapshot.error}
          </div>
        ) : null}

        {trackedFlights.length > 0 ? (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-[#0b2d52]">טיסות במעקב</h3>
              <span className="text-xs text-slate-500">מתעדכן אוטומטית</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {trackedFlights.map((flight) => (
                <TrackedFlightChip
                  key={flight.id}
                  flight={flight}
                  onSelect={openFlightDetail}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="flights-glass -mt-1 sticky top-0 z-30 rounded-b-xl p-4 md:p-5">
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
                activeClassName="bg-[#1565c0] text-white"
              >
                {label}
              </SegmentButton>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <p className="text-sm font-bold text-[#0b2d52]">
              {tab === "arrivals" ? "לוח נחיתות" : "לוח המראות"} · {dayLabel} ·{" "}
              {formatFlightDate(`${todayKey}T12:00:00`)}
            </p>

            <div className="relative w-full xl:max-w-md">
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                ⌕
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="חיפוש טיסה, חברה, יעד..."
                className="w-full rounded-lg border border-[#d6e4f0] bg-white py-3 pl-4 pr-10 text-sm text-slate-800 outline-none transition focus:border-[#1565c0] focus:ring-2 focus:ring-[#1565c0]/15"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-[#d6e4f0] pt-4">
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
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === value
                    ? "bg-[#0b2d52] text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="flights-glass relative mt-5 overflow-hidden rounded-xl">
          <div className="flights-board-header flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className="text-sm font-bold">
                {tab === "arrivals" ? "נחיתות" : "המראות"} · טרמינל 3
              </p>
              <p className="mt-0.5 text-xs text-sky-100/90">
                מציג {visibleFlights.length} טיסות · {dayLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void loadFlights({ force: true });
                void refreshTracked();
              }}
              className="rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20"
            >
              רענון עכשיו
            </button>
          </div>

          <div className="hidden border-b border-[#d6e4f0] bg-[#e3f2fd] px-6 py-3 text-[11px] font-bold tracking-[0.12em] text-[#0b2d52] md:grid md:grid-cols-[1.2fr_1.3fr_0.7fr_0.7fr_1fr] md:gap-5">
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
                  onSelect={openFlightDetail}
                  isTracked={isTracked(flight.flightCode)}
                  isSelected={selectedFlight?.id === flight.id && detailOpen}
                />
              ))
            )}
          </div>
        </section>

        <footer className="mt-10 rounded-xl border border-[#d6e4f0] bg-white px-5 py-6 text-center text-xs leading-relaxed text-slate-500">
          <p>
            מקור רשמי:{" "}
            <a
              href="https://data.gov.il/dataset/flydata"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#1565c0] hover:underline"
            >
              data.gov.il · רשות שדות התעופה
            </a>
            {" · "}
            <a
              href="https://www.iaa.gov.il/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#1565c0] hover:underline"
            >
              iaa.gov.il
            </a>
          </p>
          <p className="mt-2">
            הרשות מעדכנת כל ~15 דקות · האתר מרענן כל 30 שניות
            {connected ? ` (עודכן לפני ${secondsSinceUpdate} שניות)` : ""}
          </p>
        </footer>
      </main>

      <FlightDetailDrawer
        flight={selectedFlight}
        open={detailOpen}
        tracked={selectedFlight ? isTracked(selectedFlight.flightCode) : false}
        onClose={closeFlightDetail}
        onToggleTrack={toggleTrack}
      />
    </div>
  );
}
