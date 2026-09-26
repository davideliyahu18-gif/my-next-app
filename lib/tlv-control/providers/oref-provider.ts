import { getOrCreateCache } from "../cache/ttl-cache";
import { trackSource } from "../utils/source-health";
import { OREF_FETCH_HEADERS } from "../utils/http";
import type { ActiveAlert, AlertsSnapshot } from "../types";

/**
 * Home Front Command (Pikud HaOref) has no documented, licensed public API.
 * This connects to the same undocumented alerts.json endpoint a number of
 * third-party alert apps use in practice — it requires no authentication and
 * enforces no access control to bypass, but it is NOT an official or
 * supported integration: Pikud HaOref publishes no terms of use for it, and
 * its shape could change without notice. Connected here only because the
 * project owner explicitly asked for it after being told this. Two rules
 * remain absolute regardless: never fabricate/guess data if this fails, and
 * never infer anything (e.g. a launch origin) beyond exactly what the source
 * itself states — category + area names, verbatim, nothing more.
 *
 * Given the safety stakes, a failed or unparsable read is ALWAYS reported as
 * unavailable — even if a previous successful read is cached — rather than
 * silently serving a possibly-stale "no active alerts" as if it were current.
 */
const OREF_ALERTS_URL = "https://www.oref.org.il/WarningMessages/alert/alerts.json";
const FETCH_TIMEOUT_MS = 6_000;
const CACHE_TTL_MS = 5_000;

const UNOFFICIAL_SOURCE_NOTE =
  "מקור לא רשמי (endpoint לא מתועד) — למקרה חירום יש לפעול תמיד לפי האפליקציה הרשמית של פיקוד העורף, לא לפי מסך זה בלבד.";

type RawOrefAlert = {
  id?: string | number;
  cat?: string | number;
  title?: string;
  data?: string[];
  desc?: string;
};

/** oref.org.il has historically served this endpoint with inconsistent
 * encoding (plain UTF-8 in some periods, UTF-16LE in others). Decode
 * defensively rather than assume one. */
function decodeBody(buffer: ArrayBuffer): string {
  for (const encoding of ["utf-8", "utf-16le"] as const) {
    try {
      const text = new TextDecoder(encoding).decode(buffer).replace(/^﻿/, "").trim();
      if (!text) return text;
      JSON.parse(text);
      return text;
    } catch {
      // try next encoding
    }
  }
  // Nothing parsed as JSON — return the UTF-8 reading (trimmed) so an empty
  // body still counts as "no active alerts" rather than a hard failure.
  return new TextDecoder("utf-8").decode(buffer).replace(/^﻿/, "").trim();
}

function normalize(raw: RawOrefAlert, nowIso: string): ActiveAlert {
  return {
    id: raw.id != null ? String(raw.id) : `oref-${nowIso}`,
    category: raw.title?.trim() || "התרעת פיקוד העורף",
    areas: Array.isArray(raw.data) ? raw.data.map((a) => String(a).trim()).filter(Boolean) : [],
    issuedAt: nowIso,
  };
}

async function fetchFromSource(): Promise<ActiveAlert[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(OREF_ALERTS_URL, {
      signal: controller.signal,
      headers: OREF_FETCH_HEADERS,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`oref.org.il HTTP ${response.status}`);
    }

    const body = decodeBody(await response.arrayBuffer());
    if (!body) return []; // empty body is this endpoint's normal "no active alerts" signal

    const parsed: unknown = JSON.parse(body);
    const nowIso = new Date().toISOString();

    if (Array.isArray(parsed)) {
      return parsed.map((raw) => normalize(raw as RawOrefAlert, nowIso));
    }
    if (parsed && typeof parsed === "object" && ("data" in parsed || "title" in parsed)) {
      return [normalize(parsed as RawOrefAlert, nowIso)];
    }
    // Anything else unrecognized (e.g. "{}") — treat as no active alerts.
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

const cache = getOrCreateCache("oref", CACHE_TTL_MS, () => trackSource("oref", fetchFromSource));

export async function getAlertsSnapshot(force = false): Promise<AlertsSnapshot> {
  try {
    const active = await cache.get(force);
    return {
      state: "connected",
      reason: UNOFFICIAL_SOURCE_NOTE,
      active,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Deliberately do NOT fall back to cache.peek() here: a stale "no
    // active alerts" read is more dangerous, for a safety-relevant feed,
    // than honestly reporting the source as unavailable right now.
    return {
      state: "unavailable",
      reason: `המקור אינו זמין כרגע (${message}). ${UNOFFICIAL_SOURCE_NOTE}`,
      active: [],
      timestamp: new Date().toISOString(),
    };
  }
}
