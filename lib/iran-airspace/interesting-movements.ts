import { REASON_LABELS_HE } from "./constants";
import { headingDelta } from "./geo";
import type { Aircraft, InterestingMovement, InterestingReason } from "./types";

type Sample = {
  t: number;
  lat: number;
  lon: number;
  alt: number | null;
  heading: number | null;
  gs: number | null;
};

type HexTrack = {
  hex: string;
  firstSeenAt: number;
  lastSeenAt: number;
  recent: Sample[];
};

const RECENT_CAP = 60; // ~10 min at a 10s refresh cadence
const SHORT_WINDOW = 3; // ~30-40s back, for turn/climb detection
const HOLDING_WINDOW_MS = 3 * 60_000;
const HOLDING_RADIUS_NM = 12;
const REENTRY_GAP_MS = 5 * 60_000;
const STALE_TRACK_MS = 30 * 60_000;

const ALTITUDE_CHANGE_FT = 2500;
const HEADING_CHANGE_DEG = 45;
const UNUSUAL_ROUTE_DEG = 90;
const HIGH_SPEED_KT = 550;

/** In-memory, server-side per-hex flight history used only to detect
 * movement patterns from public position data — never to infer intent. */
export class MovementTracker {
  private tracks = new Map<string, HexTrack>();

  detect(current: Aircraft[], now = Date.now()): InterestingMovement[] {
    const seenHex = new Set<string>();
    const movements: InterestingMovement[] = [];

    for (const ac of current) {
      seenHex.add(ac.hex);
      const existing = this.tracks.get(ac.hex);
      const reasons: InterestingReason[] = [];

      if (!existing) {
        reasons.push("new-in-range");
      } else if (now - existing.lastSeenAt > REENTRY_GAP_MS) {
        reasons.push("re-entered-area");
      }

      const track: HexTrack = existing ?? {
        hex: ac.hex,
        firstSeenAt: now,
        lastSeenAt: now,
        recent: [],
      };

      if (!ac.onGround) {
        const shortBaseline = track.recent[track.recent.length - SHORT_WINDOW];
        if (shortBaseline) {
          if (
            ac.altitude != null &&
            shortBaseline.alt != null &&
            Math.abs(ac.altitude - shortBaseline.alt) >= ALTITUDE_CHANGE_FT
          ) {
            reasons.push("altitude-change");
          }
          if (
            ac.heading != null &&
            shortBaseline.heading != null &&
            headingDelta(ac.heading, shortBaseline.heading) >= HEADING_CHANGE_DEG
          ) {
            reasons.push("heading-change");
          }
        }

        if (ac.groundSpeed != null && ac.groundSpeed >= HIGH_SPEED_KT) {
          reasons.push("high-speed");
        }

        if (isHolding(track, ac, now)) {
          reasons.push("holding-pattern");
        }

        if (isUnusualRoute(track, ac)) {
          reasons.push("unusual-route");
        }
      }

      track.recent.push({
        t: now,
        lat: ac.lat,
        lon: ac.lon,
        alt: ac.altitude,
        heading: ac.heading,
        gs: ac.groundSpeed,
      });
      if (track.recent.length > RECENT_CAP) {
        track.recent = track.recent.slice(track.recent.length - RECENT_CAP);
      }
      track.lastSeenAt = now;
      this.tracks.set(ac.hex, track);

      if (reasons.length > 0) {
        movements.push({
          hex: ac.hex,
          reasons,
          reasonLabels: reasons.map((r) => REASON_LABELS_HE[r]),
          detectedAt: new Date(now).toISOString(),
        });
      }
    }

    this.prune(now, seenHex);
    return movements;
  }

  private prune(now: number, seenHex: Set<string>) {
    for (const [hex, track] of this.tracks) {
      if (!seenHex.has(hex) && now - track.lastSeenAt > STALE_TRACK_MS) {
        this.tracks.delete(hex);
      }
    }
  }
}

function nmBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = a.lat - b.lat;
  const dLon = a.lon - b.lon;
  return Math.sqrt(dLat * dLat + dLon * dLon) * 60;
}

function isHolding(track: HexTrack, ac: Aircraft, now: number): boolean {
  const window = track.recent.filter((s) => now - s.t <= HOLDING_WINDOW_MS);
  if (window.length < 6) return false;

  let turnSum = 0;
  for (let i = 1; i < window.length; i += 1) {
    const prev = window[i - 1].heading;
    const cur = window[i].heading;
    if (prev != null && cur != null) turnSum += headingDelta(cur, prev);
  }
  if (turnSum < 300) return false;

  const centroid = {
    lat: window.reduce((s, p) => s + p.lat, 0) / window.length,
    lon: window.reduce((s, p) => s + p.lon, 0) / window.length,
  };
  return window.every((p) => nmBetween(p, centroid) <= HOLDING_RADIUS_NM) && nmBetween(ac, centroid) <= HOLDING_RADIUS_NM;
}

function isUnusualRoute(track: HexTrack, ac: Aircraft): boolean {
  if (ac.heading == null || track.recent.length < 20) return false;
  const headings = track.recent.map((s) => s.heading).filter((h): h is number => h != null);
  if (headings.length < 10) return false;

  const sinSum = headings.reduce((s, h) => s + Math.sin((h * Math.PI) / 180), 0);
  const cosSum = headings.reduce((s, h) => s + Math.cos((h * Math.PI) / 180), 0);
  const meanHeading = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
  const normalized = (meanHeading + 360) % 360;

  return headingDelta(ac.heading, normalized) >= UNUSUAL_ROUTE_DEG;
}
