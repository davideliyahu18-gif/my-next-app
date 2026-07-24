import type { LatLng, MapBounds } from "./types";

/** Middle East corridor: Israel ↔ Iran. */
export const DEFAULT_BOUNDS: MapBounds = {
  north: 42.2,
  south: 24.5,
  west: 31.5,
  east: 63.5,
};

export function project(
  point: LatLng,
  width: number,
  height: number,
  bounds: MapBounds = DEFAULT_BOUNDS,
): { x: number; y: number } {
  const x =
    ((point.lng - bounds.west) / (bounds.east - bounds.west)) * width;
  const y =
    ((bounds.north - point.lat) / (bounds.north - bounds.south)) * height;
  return { x, y };
}

/** Visual ballistic-style arc (not a physics solver). */
export function ballisticPoint(
  origin: LatLng,
  target: LatLng,
  t: number,
  peakKm = 120,
): LatLng {
  const clamped = Math.min(1, Math.max(0, t));
  const lat = origin.lat + (target.lat - origin.lat) * clamped;
  const lng = origin.lng + (target.lng - origin.lng) * clamped;
  // Lift the midpoint for a readable arc on a flat map (degrees ≈ visual only).
  const arc = Math.sin(Math.PI * clamped) * (peakKm / 111);
  return { lat: lat + arc * 0.35, lng };
}

export function trajectoryPoints(
  origin: LatLng,
  target: LatLng,
  samples = 48,
): LatLng[] {
  const points: LatLng[] = [];
  for (let i = 0; i <= samples; i += 1) {
    points.push(ballisticPoint(origin, target, i / samples));
  }
  return points;
}

export function statusFromProgress(progress: number): import("./types").RocketTrackStatus {
  if (progress <= 0.02) return "pending";
  if (progress < 0.18) return "boost";
  if (progress < 0.78) return "midcourse";
  if (progress < 0.98) return "terminal";
  return "impact";
}

export function formatClock(date = new Date()): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}
