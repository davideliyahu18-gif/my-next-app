import { markPermanentlyUnavailable } from "../utils/source-health";
import type { AlertsSnapshot } from "../types";

/**
 * Home Front Command (Pikud HaOref) does not publish an official, licensed
 * public API for real-time alerts. The endpoint some hobbyist projects use
 * (oref.org.il/WarningMessages/...) is an undocumented, reverse-engineered
 * artifact of the official mobile app — not something with published terms
 * of use we can rely on or point users to as "official". Per this project's
 * own rule (never invent an endpoint, never fake alert data, and leave a
 * source honestly unavailable rather than guess), this provider is a real
 * interface with no working implementation behind it: exactly the "ready to
 * wire up, currently unavailable" shape the rest of the app expects.
 *
 * If Pikud HaOref (or a licensed aggregator) ever publishes a documented
 * public API, implement fetchFromSource() here the same way every other
 * provider in this folder does, and this file is the only one that needs
 * to change — everything downstream already expects AlertsSnapshot.
 */
const UNAVAILABLE_REASON = "אין API רשמי וציבורי של פיקוד העורף לשליפת התרעות בזמן אמת";

markPermanentlyUnavailable("oref", UNAVAILABLE_REASON);

export async function getAlertsSnapshot(): Promise<AlertsSnapshot> {
  return {
    state: "unavailable",
    reason: UNAVAILABLE_REASON,
    active: [],
    timestamp: new Date().toISOString(),
  };
}
