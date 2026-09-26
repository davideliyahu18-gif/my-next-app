"use client";

import Panel, { PanelHeading, StatTile } from "./Panel";
import type { WeatherSnapshot } from "@/lib/tlv-control/types";

function compassLabel(deg: number | null): string {
  if (deg == null) return "—";
  const dirs = ["צפון", "צפון-מזרח", "מזרח", "דרום-מזרח", "דרום", "דרום-מערב", "מערב", "צפון-מערב"];
  return dirs[Math.round(deg / 45) % 8];
}

export default function WeatherCard({ weather }: { weather: WeatherSnapshot | null }) {
  if (!weather || !weather.ok) {
    return (
      <Panel>
        <PanelHeading>☁️ מזג אוויר — נתב״ג</PanelHeading>
        <p className="px-4 pb-4 pt-2 text-sm text-slate-500">המקור אינו זמין כרגע{weather?.error ? ` (${weather.error})` : ""}</p>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeading>☁️ מזג אוויר — נתב״ג</PanelHeading>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        <StatTile label="טמפרטורה" value={weather.temperatureC != null ? `${Math.round(weather.temperatureC)}°C` : "—"} accent="text-sky-300" />
        <StatTile label="רוח" value={weather.windSpeedKmh != null ? `${Math.round(weather.windSpeedKmh)} קמ״ש` : "—"} />
        <StatTile label="כיוון רוח" value={compassLabel(weather.windDirectionDeg)} />
        <StatTile label="משבים" value={weather.windGustKmh != null ? `${Math.round(weather.windGustKmh)} קמ״ש` : "—"} />
        <StatTile label="לחות" value={weather.humidityPct != null ? `${weather.humidityPct}%` : "—"} />
        <StatTile label="עננות" value={weather.cloudCoverPct != null ? `${weather.cloudCoverPct}%` : "—"} />
        <StatTile label="משקעים" value={weather.precipitationMm != null ? `${weather.precipitationMm} מ״מ` : "—"} />
        <StatTile label="ראות" value={weather.visibilityM != null ? `${(weather.visibilityM / 1000).toFixed(1)} ק״מ` : "—"} />
      </div>

      {weather.hourly.length > 0 && (
        <div className="border-t border-white/5 p-3">
          <div className="mb-2 text-[11px] font-bold text-slate-400">תחזית לשעות הקרובות</div>
          <div className="flex gap-2 overflow-x-auto">
            {weather.hourly.map((h) => (
              <div key={h.time} className="flex shrink-0 flex-col items-center rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                <span className="text-[10px] text-slate-500">
                  {new Intl.DateTimeFormat("he-IL", { hour: "2-digit", hour12: false }).format(new Date(h.time))}
                </span>
                <span className="mt-1 text-sm font-bold text-slate-100">{h.temperatureC != null ? `${Math.round(h.temperatureC)}°` : "—"}</span>
                <span className="text-[10px] text-sky-400">{h.precipitationMm != null && h.precipitationMm > 0 ? `${h.precipitationMm}מ״מ` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
