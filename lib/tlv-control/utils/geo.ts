/** Ben Gurion Airport (LLBG / TLV). */
export const BGN_COORDS = { lat: 32.0114, lon: 34.8867 };
export const BGN_ICAO = "LLBG";
export const BGN_IATA = "TLV";

export const DEFAULT_RADIUS_NM = 50;
export const RADIUS_OPTIONS_NM = [25, 50, 100, 150] as const;

const EARTH_RADIUS_NM = 3440.065;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in nautical miles. */
export function distanceNm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Bounding box covering a radius (nm) around a center point — used for
 * providers (like OpenSky) that query by lat/lon box rather than radius. */
export function bboxAroundNm(
  center: { lat: number; lon: number },
  radiusNm: number,
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latDeltaDeg = radiusNm / 60;
  const lonDeltaDeg = radiusNm / (60 * Math.cos(toRad(center.lat)) || 1);
  return {
    minLat: center.lat - latDeltaDeg,
    maxLat: center.lat + latDeltaDeg,
    minLon: center.lon - lonDeltaDeg,
    maxLon: center.lon + lonDeltaDeg,
  };
}
