import L from "leaflet";
import type { Aircraft } from "@/lib/tlv-control/types";

const FLIGHT_PATH =
  "M21,16V14L13,9V3.5C13,2.67 12.33,2 11.5,2C10.67,2 10,2.67 10,3.5V9L2,14V16L10,13.5V19L7.5,20.5V22L11.5,21L15.5,22V20.5L13,19V13.5L21,16Z";

export function createAircraftIcon(aircraft: Aircraft, selected: boolean): L.DivIcon {
  const color = aircraft.onGround ? "#64748b" : "#38bdf8";
  const size = selected ? 30 : aircraft.onGround ? 16 : 22;
  const heading = aircraft.heading ?? 0;

  const html = `
    <div style="width:${size}px;height:${size}px;transform:rotate(${heading}deg);transform-origin:50% 50%;${selected ? `outline:2px solid ${color};outline-offset:3px;border-radius:50%;` : ""}">
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" style="filter:drop-shadow(0 0 3px ${color}${aircraft.onGround ? "55" : "aa"})">
        <path d="${FLIGHT_PATH}" fill="${color}" opacity="${aircraft.onGround ? 0.6 : 1}" stroke="#04070d" stroke-width="0.5" />
      </svg>
    </div>`;

  return L.divIcon({ className: "tlv-control-marker", html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

export function markerTooltipHtml(aircraft: Aircraft): string {
  const label = aircraft.callsign || aircraft.registration || aircraft.id.toUpperCase();
  return `<span class="tlv-control-tooltip">${label}</span>`;
}

export function bgnIcon(): L.DivIcon {
  return L.divIcon({
    className: "tlv-control-label-wrap",
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <span style="width:14px;height:14px;border-radius:999px;background:#f59e0b;border:2px solid #04070d;box-shadow:0 0 8px rgba(245,158,11,0.8)"></span>
      <span style="font-size:11px;font-weight:700;color:#fbbf24;text-shadow:0 1px 3px rgba(0,0,0,0.9);white-space:nowrap">נתב״ג · LLBG</span>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [7, 7],
  });
}
