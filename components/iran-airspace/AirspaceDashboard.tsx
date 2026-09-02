"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header, { type MapLayerId } from "./Header";
import SystemStatus from "./SystemStatus";
import FiltersPanel from "./FiltersPanel";
import SearchBar from "./SearchBar";
import MobileBottomSheet from "./MobileBottomSheet";
import InterestingMovements from "./InterestingMovements";
import ActiveAlerts, { type AlertEntry } from "./ActiveAlerts";
import AircraftDetails from "./AircraftDetails";
import TimelineBar from "./TimelineBar";
import {
  ALERT_FEED_MAX,
  CATEGORY_LABELS_HE,
  DEFAULT_FILTERS,
  REASON_LABELS_HE,
  REFRESH_INTERVAL_MS,
  REGION_CENTER,
  TIMELINE_HISTORY_MAX,
  TRAIL_MAX_POINTS,
} from "@/lib/iran-airspace/constants";
import { bearing, compassLabelHe } from "@/lib/iran-airspace/geo";
import type {
  Aircraft,
  AircraftFilters,
  AircraftSnapshot,
  ConnectionState,
  InterestingMovement,
  ProviderName,
  SystemStatus as SystemStatusT,
  TrailPoint,
} from "@/lib/iran-airspace/types";

const LiveMap = dynamic(() => import("./LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
      טוען מפה…
    </div>
  ),
});

const FETCH_TIMEOUT_MS = 8_000;
const REGION_CENTER_LATLNG = { lat: REGION_CENTER[0], lon: REGION_CENTER[1] };

function matchesFilters(aircraft: Aircraft, filters: AircraftFilters): boolean {
  if (!filters.showAircraft) return false;
  if (aircraft.category === "civil" && !filters.showCivil) return false;
  if (aircraft.category === "military" && !filters.showMilitary) return false;
  if (aircraft.category === "tanker" && !filters.showTanker) return false;
  if (aircraft.category === "intel" && !filters.showIntel) return false;
  if (!filters.showNoCallsign && !aircraft.callsign) return false;

  if (filters.callsign && !aircraft.callsign?.toUpperCase().includes(filters.callsign.toUpperCase())) {
    return false;
  }
  if (
    filters.registration &&
    !aircraft.registration?.toUpperCase().includes(filters.registration.toUpperCase())
  ) {
    return false;
  }
  if (filters.icao && !aircraft.hex.toUpperCase().includes(filters.icao.toUpperCase())) {
    return false;
  }
  if (
    filters.aircraftType &&
    !aircraft.aircraftType?.toUpperCase().includes(filters.aircraftType.toUpperCase())
  ) {
    return false;
  }
  const minAlt = Number(filters.minAltitude);
  if (filters.minAltitude && !Number.isNaN(minAlt) && (aircraft.altitude ?? -Infinity) < minAlt) {
    return false;
  }
  const maxAlt = Number(filters.maxAltitude);
  if (filters.maxAltitude && !Number.isNaN(maxAlt) && (aircraft.altitude ?? Infinity) > maxAlt) {
    return false;
  }
  const minSpeed = Number(filters.minSpeed);
  if (filters.minSpeed && !Number.isNaN(minSpeed) && (aircraft.groundSpeed ?? -Infinity) < minSpeed) {
    return false;
  }
  return true;
}

const ALERT_PHRASES: Record<string, string> = {
  "new-in-range": "נכנס לטווח המעקב",
  "altitude-change": "ביצע שינוי גובה משמעותי",
  "heading-change": "ביצע שינוי כיוון משמעותי",
  "high-speed": "טס במהירות גבוהה יחסית",
  "re-entered-area": "נראה שוב באזור",
  "holding-pattern": "בדפוס המתנה (Holding)",
  "unusual-route": "טס במסלול שונה מהרגיל",
};

function buildAlertEntries(snapshot: AircraftSnapshot): AlertEntry[] {
  const aircraftByHex = new Map(snapshot.aircraft.map((a) => [a.hex, a] as const));
  const entries: AlertEntry[] = [];

  for (const movement of snapshot.interesting) {
    const aircraft = aircraftByHex.get(movement.hex);
    if (!aircraft) continue;
    const reason = movement.reasons[0] ?? "new-in-range";
    const phrase = ALERT_PHRASES[reason] ?? REASON_LABELS_HE[reason] ?? "מסומן כמעניין";
    const direction = compassLabelHe(bearing(REGION_CENTER_LATLNG, { lat: aircraft.lat, lon: aircraft.lon }));
    const label = aircraft.callsign || aircraft.hex.toUpperCase();

    entries.push({
      id: `${movement.hex}-${movement.detectedAt}-${reason}`,
      hex: movement.hex,
      category: aircraft.category,
      text: `מטוס ${CATEGORY_LABELS_HE[aircraft.category]} (${label}) ${phrase} · כיוון ${direction} מהמרכז`,
      time: new Intl.DateTimeFormat("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(movement.detectedAt)),
    });
  }

  return entries;
}

type MobilePanel = "status" | "movements" | "filters" | null;
type HistoryEntry = { t: number; snapshot: AircraftSnapshot };

export default function AirspaceDashboard() {
  const [snapshot, setSnapshot] = useState<AircraftSnapshot | null>(null);
  const [status, setStatus] = useState<SystemStatusT | null>(null);
  const [filters, setFilters] = useState<AircraftFilters>(DEFAULT_FILTERS);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ hex: string; token: number } | null>(null);
  const [trails, setTrails] = useState<Map<string, TrailPoint[]>>(new Map());
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000);
  const [toast, setToast] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [layerId, setLayerId] = useState<MapLayerId>("dark");
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [scrubIndex, setScrubIndex] = useState(0);

  const inFlightRef = useRef(false);
  const lastSourceRef = useRef<ProviderName | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, durationMs = 4500) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), durationMs);
  }, []);

  const poll = useCallback(
    async (force = false) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS + 1000);

      try {
        const response = await fetch(`/api/aircraft${force ? "?refresh=1" : ""}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = (await response.json()) as AircraftSnapshot;
        setSnapshot(data);
        setHistory((prev) => {
          const next = [...prev, { t: Date.now(), snapshot: data }];
          return next.length > TIMELINE_HISTORY_MAX ? next.slice(next.length - TIMELINE_HISTORY_MAX) : next;
        });

        const newAlerts = buildAlertEntries(data);
        if (newAlerts.length > 0) {
          setAlerts((prev) => [...newAlerts.reverse(), ...prev].slice(0, ALERT_FEED_MAX));
        }

        if (data.aircraft.length === 0) {
          showToast("אין כרגע נתוני ADS-B זמינים באזור");
        } else if (data.fellBackToSecondary && lastSourceRef.current !== data.source) {
          showToast("עברנו למקור נתונים חלופי");
        }
        lastSourceRef.current = data.source;

        setTrails((prev) => {
          const next = new Map(prev);
          for (const ac of data.aircraft) {
            const points = next.get(ac.hex) ?? [];
            const lastPoint = points[points.length - 1];
            if (!lastPoint || lastPoint.lat !== ac.lat || lastPoint.lon !== ac.lon) {
              const updated = [...points, { lat: ac.lat, lon: ac.lon, altitude: ac.altitude, t: Date.now() }];
              next.set(
                ac.hex,
                updated.length > TRAIL_MAX_POINTS ? updated.slice(updated.length - TRAIL_MAX_POINTS) : updated,
              );
            }
          }
          return next;
        });

        try {
          const statusRes = await fetch("/api/status", { cache: "no-store" });
          setStatus((await statusRes.json()) as SystemStatusT);
        } catch {
          // Status is a nice-to-have; ignore failures.
        }
      } catch {
        showToast("לא ניתן לקבל נתוני טיסה. מנסה מקור חלופי…");
      } finally {
        clearTimeout(timeout);
        inFlightRef.current = false;
        setCountdown(REFRESH_INTERVAL_MS / 1000);
      }
    },
    [showToast],
  );

  useEffect(() => {
    poll(true);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          poll();
          return REFRESH_INTERVAL_MS / 1000;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displaySnapshot = isLive ? snapshot : history[Math.min(scrubIndex, history.length - 1)]?.snapshot ?? snapshot;

  const filteredAircraft = useMemo(
    () => (displaySnapshot ? displaySnapshot.aircraft.filter((a) => matchesFilters(a, filters)) : []),
    [displaySnapshot, filters],
  );

  const aircraftByHex = useMemo(
    () => new Map((displaySnapshot?.aircraft ?? []).map((a) => [a.hex, a] as const)),
    [displaySnapshot],
  );

  const selectedAircraft = selectedHex ? aircraftByHex.get(selectedHex) ?? null : null;
  const selectedTrail = selectedHex ? trails.get(selectedHex) ?? [] : [];

  const connection: ConnectionState = status?.connection ?? (snapshot?.ok ? "connected" : "down");

  const handleSelect = useCallback((hex: string | null) => {
    setSelectedHex(hex);
    if (hex) {
      setFocusRequest({ hex, token: Date.now() });
      setMobileDetailsOpen(true);
      setMobilePanel(null);
    } else {
      setMobileDetailsOpen(false);
    }
  }, []);

  const handleFilterChange = useCallback((next: Partial<AircraftFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const handleToggleCategory = useCallback(
    (key: "showCivil" | "showMilitary" | "showTanker" | "showIntel") => {
      setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [],
  );

  const handleScrub = useCallback((index: number) => {
    setIsLive(false);
    setScrubIndex(index);
  }, []);

  const handleGoLive = useCallback(() => {
    // Toggling from live to paused freezes on the current latest point;
    // toggling from paused to live jumps back to the latest point.
    setScrubIndex(history.length - 1);
    setIsLive((prev) => !prev);
  }, [history.length]);

  const categoryFilters = useMemo(
    () => ({
      showCivil: filters.showCivil,
      showMilitary: filters.showMilitary,
      showTanker: filters.showTanker,
      showIntel: filters.showIntel,
    }),
    [filters.showCivil, filters.showMilitary, filters.showTanker, filters.showIntel],
  );

  const displayInteresting: InterestingMovement[] = displaySnapshot?.interesting ?? [];

  return (
    <div dir="rtl" className="flex h-[100svh] flex-col overflow-hidden font-sans text-slate-100">
      <Header
        connection={connection}
        lastUpdate={snapshot?.timestamp ?? null}
        alerts={alerts}
        onViewAllAlerts={() => setMobilePanel("movements")}
        layerId={layerId}
        onLayerChange={setLayerId}
      />

      <div className="relative flex min-h-0 flex-1 gap-3 overflow-hidden p-0 sm:gap-3 sm:p-3">
        <aside className="hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto pb-2 sm:flex iran-airspace-scroll">
          <SystemStatus snapshot={displaySnapshot} visibleCount={filteredAircraft.length} connection={connection} />
          <ActiveAlerts alerts={alerts} onSelect={handleSelect} />
          <FiltersPanel filters={filters} onChange={handleFilterChange} />
        </aside>

        <main className="relative min-h-0 flex-1">
          <div className="absolute inset-x-2 top-2 z-30 flex justify-center sm:inset-x-3 sm:top-3 sm:justify-start">
            <SearchBar aircraft={displaySnapshot?.aircraft ?? []} onSelect={handleSelect} />
          </div>

          <LiveMap
            aircraft={filteredAircraft}
            selectedHex={selectedHex}
            onSelectAircraft={handleSelect}
            trails={trails}
            showTrails={filters.showTrails}
            showLabels={filters.showLabels}
            focusRequest={focusRequest}
            categoryFilters={categoryFilters}
            onToggleCategory={handleToggleCategory}
            layerId={layerId}
            onLayerChange={setLayerId}
          />

          <div className="pointer-events-none absolute bottom-2 right-2 z-20 sm:bottom-3 sm:right-3">
            <span className="rounded-md border border-white/10 bg-[#0a1220]/85 px-2.5 py-1 text-[10px] font-mono text-slate-400 backdrop-blur-xl sm:text-xs">
              {isLive ? `עדכון הבא בעוד ${countdown} שניות` : "מציג נקודת זמן היסטורית"}
            </span>
          </div>

          {toast && (
            <div className="pointer-events-none absolute inset-x-0 bottom-14 z-40 flex justify-center px-3 sm:bottom-4">
              <div className="pointer-events-auto rounded-lg border border-amber-400/20 bg-[#141014]/95 px-4 py-2 text-xs font-medium text-amber-200 shadow-2xl backdrop-blur-xl">
                {toast}
              </div>
            </div>
          )}

          {selectedAircraft && (
            <div className="absolute bottom-2 left-2 z-30 hidden w-80 sm:block">
              <AircraftDetails aircraft={selectedAircraft} trail={selectedTrail} onClose={() => handleSelect(null)} />
            </div>
          )}
        </main>

        <aside className="hidden w-80 shrink-0 flex-col gap-3 overflow-hidden pb-2 sm:flex">
          <InterestingMovements movements={displayInteresting} aircraftByHex={aircraftByHex} onSelect={handleSelect} />
        </aside>
      </div>

      <TimelineBar
        history={history}
        currentIndex={isLive ? history.length - 1 : scrubIndex}
        isLive={isLive}
        onScrub={handleScrub}
        onGoLive={handleGoLive}
      />
      <div className="hidden border-t border-white/5 bg-[#050b14] px-4 py-1 text-center text-[10px] text-slate-600 sm:block">
        מקור נתונים: {snapshot?.source ?? "—"} (ADS-B ציבורי, חינמי) · עדכון כל {REFRESH_INTERVAL_MS / 1000} שניות
      </div>

      <nav className="relative z-[510] flex shrink-0 items-stretch gap-1 border-t border-white/5 bg-[#050b14]/95 p-1.5 backdrop-blur-xl sm:hidden" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.375rem)" }}>
        {(
          [
            ["status", "סטטוס"],
            ["movements", "תנועות"],
            ["filters", "פילטרים"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobilePanel(id)}
            className="flex-1 rounded-lg py-2 text-xs font-bold text-slate-300 active:bg-white/10"
          >
            {label}
          </button>
        ))}
      </nav>

      <MobileBottomSheet open={mobilePanel === "status"} onClose={() => setMobilePanel(null)} title="סטטוס מערכת">
        <SystemStatus snapshot={displaySnapshot} visibleCount={filteredAircraft.length} connection={connection} />
      </MobileBottomSheet>
      <MobileBottomSheet open={mobilePanel === "movements"} onClose={() => setMobilePanel(null)} title="תנועות והתראות">
        <div className="space-y-3">
          <ActiveAlerts
            alerts={alerts}
            onSelect={(hex) => {
              handleSelect(hex);
              setMobilePanel(null);
            }}
          />
          <InterestingMovements
            movements={displayInteresting}
            aircraftByHex={aircraftByHex}
            onSelect={(hex) => {
              handleSelect(hex);
              setMobilePanel(null);
            }}
          />
        </div>
      </MobileBottomSheet>
      <MobileBottomSheet open={mobilePanel === "filters"} onClose={() => setMobilePanel(null)} title="פילטרים">
        <FiltersPanel filters={filters} onChange={handleFilterChange} />
      </MobileBottomSheet>
      <MobileBottomSheet open={mobileDetailsOpen && Boolean(selectedAircraft)} onClose={() => handleSelect(null)} title="פרטי מטוס">
        {selectedAircraft && (
          <AircraftDetails aircraft={selectedAircraft} trail={selectedTrail} onClose={() => handleSelect(null)} />
        )}
      </MobileBottomSheet>
    </div>
  );
}
