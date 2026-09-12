import L from "leaflet";
import { CATEGORY_COLORS } from "@/lib/iran-airspace/constants";
import type { Aircraft } from "@/lib/iran-airspace/types";

/** A top-down airplane silhouette, nose pointing north by default, rotated
 * to heading and tinted by category. */
function planeSvg(color: string, size: number, dim: boolean): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="filter:drop-shadow(0 0 3px ${color}${dim ? "55" : "aa"})">
    <path d="M21,16V14L13,9V3.5C13,2.67 12.33,2 11.5,2C10.67,2 10,2.67 10,3.5V9L2,14V16L10,13.5V19L7.5,20.5V22L11.5,21L15.5,22V20.5L13,19V13.5L21,16Z"
      fill="${color}" opacity="${dim ? 0.55 : 1}" stroke="#04070d" stroke-width="0.5" />
  </svg>`;
}

export function createAircraftIcon(aircraft: Aircraft, selected: boolean): L.DivIcon {
  const color = CATEGORY_COLORS[aircraft.category] ?? CATEGORY_COLORS.civil;
  const size = selected ? 30 : aircraft.onGround ? 16 : 22;
  const heading = aircraft.heading ?? 0;

  const html = `
    <div style="width:${size}px;height:${size}px;transform:rotate(${heading}deg);transform-origin:50% 50%;${selected ? `outline:2px solid ${color};outline-offset:3px;border-radius:50%;` : ""}">
      ${planeSvg(color, size, aircraft.onGround)}
    </div>`;

  return L.divIcon({
    className: "iran-airspace-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function markerTooltipHtml(aircraft: Aircraft): string {
  const label = aircraft.callsign || aircraft.registration || aircraft.hex.toUpperCase();
  return `<span class="iran-airspace-tooltip">${label}</span>`;
}
