import L from "leaflet";
import { CATEGORY_COLORS } from "@/lib/iran-airspace/constants";
import type { AircraftCategory, TrailPoint } from "@/lib/iran-airspace/types";

/** Draws the observed (session-only) trail for the selected aircraft. */
export function buildTrailPolyline(points: TrailPoint[], category: AircraftCategory): L.Polyline | null {
  if (points.length < 2) return null;
  const latLngs = points.map((p) => [p.lat, p.lon] as L.LatLngExpression);
  return L.polyline(latLngs, {
    color: CATEGORY_COLORS[category] ?? CATEGORY_COLORS.civil,
    weight: 2.5,
    opacity: 0.75,
    dashArray: "1 6",
    lineCap: "round",
  });
}
