"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "./Header";
import SystemStatus from "./SystemStatus";
import FiltersPanel from "./FiltersPanel";
import SearchBar from "./SearchBar";
import MobileBottomSheet from "./MobileBottomSheet";
import InterestingMovements from "./InterestingMovements";
import AircraftDetails from "./AircraftDetails";
import {
  DEFAULT_FILTERS,
  REFRESH_INTERVAL_MS,
  TRAIL_MAX_POINTS,
} from "@/lib/iran-airspace/constants";
import type {
  Aircraft,
  AircraftFilters,
  AircraftSnapshot,
  ConnectionState,
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

type MobilePanel = "status" | "movements" | "filters" | null;

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

  const filteredAircraft = useMemo(
    () => (snapshot ? snapshot.aircraft.filter((a) => matchesFilters(a, filters)) : []),
    [snapshot, filters],
  );

  const aircraftByHex = useMemo(
    () => new Map((snapshot?.aircraft ?? []).map((a) => [a.hex, a] as const)),
    [snapshot],
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

  return (
    <div dir="rtl" className="flex h-[100dvh] min-h-screen flex-col overflow-hidden font-sans text-slate-100">
      <Header connection={connection} lastUpdate={snapshot?.timestamp ?? null} />

      <div className="relative flex min-h-0 flex-1 gap-3 overflow-hidden p-0 sm:gap-3 sm:p-3">
        <aside className="hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto pb-2 sm:flex iran-airspace-scroll">
          <SystemStatus snapshot={snapshot} visibleCount={filteredAircraft.length} connection={connection} />
          <FiltersPanel filters={filters} onChange={handleFilterChange} />
        </aside>

        <main className="relative min-h-0 flex-1">
          <div className="absolute inset-x-2 top-2 z-30 flex justify-center sm:inset-x-3 sm:top-3 sm:justify-start">
            <SearchBar aircraft={snapshot?.aircraft ?? []} onSelect={handleSelect} />
          </div>

          <LiveMap
            aircraft={filteredAircraft}
            selectedHex={selectedHex}
            onSelectAircraft={handleSelect}
            trail={selectedTrail}
            showTrails={filters.showTrails}
            showLabels={filters.showLabels}
            focusRequest={focusRequest}
          />

          <div className="pointer-events-none absolute bottom-2 right-2 z-20 sm:bottom-3 sm:right-3">
            <span className="rounded-md border border-white/10 bg-[#0a1220]/85 px-2.5 py-1 text-[10px] font-mono text-slate-400 backdrop-blur-xl sm:text-xs">
              עדכון הבא בעוד {countdown} שניות
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
          <InterestingMovements
            movements={snapshot?.interesting ?? []}
            aircraftByHex={aircraftByHex}
            onSelect={handleSelect}
          />
        </aside>
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
        <SystemStatus snapshot={snapshot} visibleCount={filteredAircraft.length} connection={connection} />
      </MobileBottomSheet>
      <MobileBottomSheet open={mobilePanel === "movements"} onClose={() => setMobilePanel(null)} title="תנועות מעניינות">
        <InterestingMovements
          movements={snapshot?.interesting ?? []}
          aircraftByHex={aircraftByHex}
          onSelect={(hex) => {
            handleSelect(hex);
            setMobilePanel(null);
          }}
        />
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
