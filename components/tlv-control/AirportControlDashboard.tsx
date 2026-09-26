"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "./Header";
import Nav from "./Nav";
import EmergencyBanner from "./EmergencyBanner";
import Panel, { PanelHeading, StatTile } from "./Panel";
import AircraftDetails from "./AircraftDetails";
import AircraftList from "./AircraftList";
import FlightBoard from "./FlightBoard";
import FlightSearch from "./FlightSearch";
import WeatherCard from "./WeatherCard";
import AviationWeatherCard from "./AviationWeatherCard";
import AlertsPanel from "./AlertsPanel";
import SourceHealthPanel from "./SourceHealthPanel";
import type { NavSection, SourceConnections } from "./types";
import type {
  AircraftSnapshot,
  AlertsSnapshot,
  AviationWeatherSnapshot,
  BgnFlightsSnapshot,
  HealthSnapshot,
  WeatherSnapshot,
} from "@/lib/tlv-control/types";
import { DEFAULT_RADIUS_NM } from "@/lib/tlv-control/utils/geo";

const LiveMap = dynamic(() => import("./LiveMap"), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">טוען מפה…</div>,
});

const AIRCRAFT_POLL_MS = 12_000;
const FLIGHTS_POLL_MS = 30_000;
const WEATHER_POLL_MS = 5 * 60_000;
const ALERTS_POLL_MS = 20_000;
const HEALTH_POLL_MS = 15_000;

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

export default function AirportControlDashboard() {
  const [section, setSection] = useState<NavSection>("map");
  const [aircraftSnap, setAircraftSnap] = useState<AircraftSnapshot | null>(null);
  const [flightsSnap, setFlightsSnap] = useState<BgnFlightsSnapshot | null>(null);
  const [weatherSnap, setWeatherSnap] = useState<WeatherSnapshot | null>(null);
  const [aviationSnap, setAviationSnap] = useState<AviationWeatherSnapshot | null>(null);
  const [alertsSnap, setAlertsSnap] = useState<AlertsSnapshot | null>(null);
  const [healthSnap, setHealthSnap] = useState<HealthSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pollAircraft = useCallback(async () => {
    try {
      const res = await fetch(`/api/tlv/aircraft?radius=${DEFAULT_RADIUS_NM}`, { cache: "no-store" });
      setAircraftSnap(await res.json());
    } catch {
      setAircraftSnap((prev) => (prev ? { ...prev, ok: false, error: "המקור אינו זמין כרגע" } : prev));
    }
  }, []);

  const pollFlights = useCallback(async () => {
    try {
      const res = await fetch("/api/tlv/flights", { cache: "no-store" });
      setFlightsSnap(await res.json());
    } catch {
      setFlightsSnap((prev) => (prev ? { ...prev, ok: false, error: "המקור אינו זמין כרגע" } : prev));
    }
  }, []);

  const pollWeather = useCallback(async () => {
    try {
      const res = await fetch("/api/tlv/weather", { cache: "no-store" });
      setWeatherSnap(await res.json());
    } catch {
      setWeatherSnap((prev) => (prev ? { ...prev, ok: false } : prev));
    }
  }, []);

  const pollAviation = useCallback(async () => {
    try {
      const res = await fetch("/api/tlv/aviation-weather", { cache: "no-store" });
      setAviationSnap(await res.json());
    } catch {
      setAviationSnap((prev) => (prev ? { ...prev, ok: false } : prev));
    }
  }, []);

  const pollAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/tlv/alerts", { cache: "no-store" });
      setAlertsSnap(await res.json());
    } catch {
      // leave last-known state
    }
  }, []);

  const pollHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/tlv/health", { cache: "no-store" });
      setHealthSnap(await res.json());
    } catch {
      // leave last-known state
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial mount-time fetch, same pattern as AirspaceDashboard
    pollAircraft();
    pollFlights();
    pollWeather();
    pollAviation();
    pollAlerts();
    pollHealth();
    const t1 = setInterval(pollAircraft, AIRCRAFT_POLL_MS);
    const t2 = setInterval(pollFlights, FLIGHTS_POLL_MS);
    const t3 = setInterval(pollWeather, WEATHER_POLL_MS);
    const t4 = setInterval(pollAviation, WEATHER_POLL_MS);
    const t5 = setInterval(pollAlerts, ALERTS_POLL_MS);
    const t6 = setInterval(pollHealth, HEALTH_POLL_MS);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      clearInterval(t3);
      clearInterval(t4);
      clearInterval(t5);
      clearInterval(t6);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aircraft = useMemo(() => aircraftSnap?.aircraft ?? [], [aircraftSnap]);
  const selectedAircraft = selectedId ? aircraft.find((a) => a.id === selectedId) ?? null : null;
  const activeAlert = alertsSnap?.active[0] ?? null;

  // Each data source gets its own status — a failure in one (e.g. the
  // aircraft feed) must never be reported as the whole system being down
  // when other sources (flights, weather) are working fine.
  const sourceConnections: SourceConnections = useMemo(() => {
    const aircraftState = !aircraftSnap
      ? "down"
      : aircraftSnap.ok
        ? "connected"
        : aircraft.length > 0
          ? "degraded"
          : "down";
    const bgnState = !flightsSnap
      ? "down"
      : flightsSnap.ok
        ? "connected"
        : (flightsSnap.flights?.length ?? 0) > 0
          ? "degraded"
          : "down";
    const weatherState = !weatherSnap ? "down" : weatherSnap.ok ? "connected" : "down";
    const alertsState = !alertsSnap ? "off" : alertsSnap.state === "connected" ? "connected" : "off";
    return { aircraft: aircraftState, bgn: bgnState, weather: weatherState, alerts: alertsState };
  }, [aircraftSnap, aircraft.length, flightsSnap, weatherSnap, alertsSnap]);

  const todayDepartures = useMemo(() => (flightsSnap?.departures ?? []).filter((f) => isToday(f.scheduledAt)), [flightsSnap]);
  const todayArrivals = useMemo(() => (flightsSnap?.arrivals ?? []).filter((f) => isToday(f.scheduledAt)), [flightsSnap]);
  const delayedCount = useMemo(() => (flightsSnap?.flights ?? []).filter((f) => f.statusTone === "delayed").length, [flightsSnap]);

  return (
    <div dir="rtl" className="flex h-[100svh] flex-col overflow-hidden font-sans text-slate-100">
      <Header sources={sourceConnections} emergencyActive={Boolean(activeAlert)} />
      {activeAlert && <EmergencyBanner alert={activeAlert} />}

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row-reverse">
        <Nav active={section} onChange={setSection} alertBadge={alertsSnap?.active.length} />

        <div className="min-h-0 flex-1 overflow-hidden">
          {section === "map" && (
            <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 sm:flex-row sm:overflow-hidden">
              <aside className="flex shrink-0 flex-col gap-3 sm:w-64 sm:overflow-y-auto">
                <Panel>
                  <PanelHeading>סטטוס</PanelHeading>
                  <div className="grid grid-cols-2 gap-2 p-3">
                    <StatTile label="מטוסים סביב נתב״ג" value={aircraft.length} accent="text-sky-300" />
                    <StatTile label="עיכובים" value={delayedCount} accent="text-red-400" />
                    <StatTile label="המראות היום" value={todayDepartures.length} />
                    <StatTile label="נחיתות היום" value={todayArrivals.length} />
                  </div>
                </Panel>
                <WeatherCard weather={weatherSnap} />
              </aside>

              <main className="relative min-h-[45vh] flex-1 overflow-hidden rounded-xl sm:min-h-0">
                <LiveMap aircraft={aircraft} selectedId={selectedId} onSelectAircraft={setSelectedId} />
                {selectedAircraft && (
                  <div className="absolute bottom-2 left-2 z-30 w-72 max-w-[calc(100%-1rem)]">
                    <AircraftDetails aircraft={selectedAircraft} onClose={() => setSelectedId(null)} />
                  </div>
                )}
              </main>

              <aside className="flex shrink-0 flex-col gap-3 sm:w-72 sm:overflow-y-auto">
                <FlightBoard title="🛫 המראות Live" flights={(flightsSnap?.departures ?? []).slice(0, 8)} />
                <FlightBoard title="🛬 נחיתות Live" flights={(flightsSnap?.arrivals ?? []).slice(0, 8)} />
              </aside>
            </div>
          )}

          {section === "departures" && (
            <div className="h-full p-3">
              <FlightBoard title="🛫 המראות – נתב״ג" flights={flightsSnap?.departures ?? []} />
            </div>
          )}

          {section === "arrivals" && (
            <div className="h-full p-3">
              <FlightBoard title="🛬 נחיתות – נתב״ג" flights={flightsSnap?.arrivals ?? []} />
            </div>
          )}

          {section === "byDate" && (
            <div className="h-full overflow-y-auto p-3">
              <FlightSearch emphasizeDate />
            </div>
          )}

          {section === "search" && (
            <div className="h-full overflow-y-auto p-3">
              <FlightSearch />
            </div>
          )}

          {section === "aircraft" && (
            <div className="h-full p-3">
              <AircraftList aircraft={aircraft} onSelect={(id) => { setSelectedId(id); setSection("map"); }} />
            </div>
          )}

          {section === "weather" && (
            <div className="h-full space-y-3 overflow-y-auto p-3">
              <WeatherCard weather={weatherSnap} />
              <AviationWeatherCard data={aviationSnap} />
            </div>
          )}

          {section === "alerts" && (
            <div className="h-full space-y-3 overflow-y-auto p-3">
              <AlertsPanel alerts={alertsSnap} />
              {healthSnap && <SourceHealthPanel sources={healthSnap.sources} />}
            </div>
          )}
        </div>
      </div>

      <div className="hidden border-t border-white/5 bg-[#050b14] px-4 py-1 text-center text-[10px] text-slate-600 sm:block">
        מקורות: ADSB.fi / ADSB.lol / OpenSky · Open-Meteo · Aviation Weather Center · data.gov.il (רשות שדות התעופה) · פיקוד העורף: לא זמין (אין API רשמי)
      </div>
    </div>
  );
}
