import L from "leaflet";
import { CATEGORY_COLORS } from "@/lib/iran-airspace/constants";
import type { Aircraft } from "@/lib/iran-airspace/types";

/** A small delta-wing glyph, rotated to heading and tinted by category. */
function planeSvg(color: string, size: number, dim: boolean): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="filter:drop-shadow(0 0 3px ${color}${dim ? "55" : "aa"})">
    <path d="M12 1.5 14.1 8.6 21.5 12 14.1 13.6 13 22 12 19.5 11 22 9.9 13.6 2.5 12 9.9 8.6 12 1.5Z"
      fill="${color}" opacity="${dim ? 0.55 : 1}" stroke="#04070d" stroke-width="0.6" />
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
