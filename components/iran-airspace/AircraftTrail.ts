import L from "leaflet";
import { CATEGORY_COLORS } from "@/lib/iran-airspace/constants";
import type { AircraftCategory, TrailPoint } from "@/lib/iran-airspace/types";

/** Draws the observed (session-only) trail behind an aircraft. The selected
 * aircraft gets a longer, more prominent line; others get a short, subtle one. */
export function buildTrailPolyline(
  points: TrailPoint[],
  category: AircraftCategory,
  emphasized = false,
): L.Polyline | null {
  if (points.length < 2) return null;
  const latLngs = points.map((p) => [p.lat, p.lon] as L.LatLngExpression);
  return L.polyline(latLngs, {
    color: CATEGORY_COLORS[category] ?? CATEGORY_COLORS.civil,
    weight: emphasized ? 2.5 : 1.5,
    opacity: emphasized ? 0.8 : 0.4,
    dashArray: emphasized ? "1 6" : undefined,
    lineCap: "round",
    interactive: false,
  });
}
