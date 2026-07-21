/**
 * Per-user subscribers — commands work in the group (and still in DM).
 * Settings are keyed by the sender's WhatsApp JID.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PERSONAL_USERS_FILE = path.join(__dirname, "personal-users.json");

/** @typedef {{
 *  active: boolean,
 *  watches: string[],
 *  maxPriceIls: number,
 *  lastAlertByWatch: Record<string, number|null>,
 *  joinedAt: number,
 *  updatedAt: number,
 *  pushName?: string|null,
 * }} PersonalUser */

/** @type {Map<string, PersonalUser>} */
const users = new Map();

export const DEFAULT_WATCHES = ["thailand", "budapest"];

const WATCH_LABELS_HE = {
  thailand: "🇹🇭 תאילנד",
  budapest: "🇭🇺 בודפשט",
};

function defaultMaxPriceIls() {
  return Number(process.env.FLIGHT_DEALS_PERSONAL_MAX_PRICE_ILS ?? "4500");
}

export function formatWatchesHe(watches) {
  const list = normalizeWatches(watches);
  return list.map((w) => WATCH_LABELS_HE[w] || w).join(" · ");
}

function normalizeUserJid(jid) {
  if (!jid) return "";
  // Strip device suffix: 9725...:12@s.whatsapp.net → 9725...@s.whatsapp.net
  const base = String(jid).split(":")[0];
  if (base.includes("@")) return base;
  return `${base}@s.whatsapp.net`;
}

function normalizeWatches(value) {
  const list = Array.isArray(value) ? value : DEFAULT_WATCHES;
  const cleaned = [...new Set(list.map((w) => String(w).toLowerCase()).filter(Boolean))];
  return cleaned.length ? cleaned : [...DEFAULT_WATCHES];
}

function normalizeLastAlertByWatch(raw, legacyPrice = null) {
  const out = { thailand: null, budapest: null };
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(out)) {
      if (raw[key] == null) continue;
      const n = Number(raw[key]);
      out[key] = Number.isFinite(n) ? n : null;
    }
  }
  // Migrate old single lastAlertPriceIls → thailand slot.
  if (legacyPrice != null && out.thailand == null) {
    const n = Number(legacyPrice);
    if (Number.isFinite(n)) out.thailand = n;
  }
  return out;
}

export async function loadPersonalUsers() {
  users.clear();
  if (!existsSync(PERSONAL_USERS_FILE)) return;
  try {
    const raw = JSON.parse(await readFile(PERSONAL_USERS_FILE, "utf8"));
    for (const [jid, user] of Object.entries(raw?.users ?? raw ?? {})) {
      if (!jid || !user || typeof user !== "object") continue;
      users.set(normalizeUserJid(jid), {
        active: user.active !== false,
        watches: normalizeWatches(user.watches ?? user.watch),
        maxPriceIls: Number(user.maxPriceIls ?? defaultMaxPriceIls()),
        lastAlertByWatch: normalizeLastAlertByWatch(
          user.lastAlertByWatch,
          user.lastAlertPriceIls,
        ),
        joinedAt: Number(user.joinedAt ?? Date.now()),
        updatedAt: Number(user.updatedAt ?? Date.now()),
        pushName: user.pushName ?? null,
      });
    }
  } catch {
    // ignore corrupt file
  }
}

export async function savePersonalUsers() {
  const payload = { users: Object.fromEntries(users) };
  await writeFile(PERSONAL_USERS_FILE, JSON.stringify(payload, null, 2) + "\n");
}

export function getPersonalUser(jid) {
  return users.get(normalizeUserJid(jid)) ?? null;
}

export function listActivePersonalUsers() {
  return [...users.entries()].filter(([, u]) => u.active);
}

export async function upsertPersonalUser(jid, patch = {}) {
  const key = normalizeUserJid(jid);
  const prev = users.get(key);
  const next = {
    active: true,
    watches: [...DEFAULT_WATCHES],
    maxPriceIls: defaultMaxPriceIls(),
    lastAlertByWatch: { thailand: null, budapest: null },
    joinedAt: Date.now(),
    updatedAt: Date.now(),
    pushName: null,
    ...(prev ?? {}),
    ...patch,
    watches: normalizeWatches(patch.watches ?? prev?.watches),
    lastAlertByWatch: normalizeLastAlertByWatch(
      patch.lastAlertByWatch ?? prev?.lastAlertByWatch,
      patch.lastAlertPriceIls ?? prev?.lastAlertPriceIls,
    ),
    updatedAt: Date.now(),
  };
  users.set(key, next);
  await savePersonalUsers();
  return next;
}

export function personalHelpText() {
  return [
    "👋 *בוט טיסות — פקודות*",
    "",
    "כתבו *בקבוצה* (או בפרטי):",
    "",
    "• *תאילנד* / *אמירטס* — דיל אמירטס אמיתי בלבד (10/02/2027–10/03/2027 + מזוודה)",
    "• *סטטוס* / *מחפש* / *בוט מחפש* — כל היעדים",
    "• *התחל* — הצטרפות למעקב",
    "• *עצור* — ביטול התראות",
    "• *תקציב 3200* — מקסימום בשקלים",
    "• *רק תאילנד* / *רק בודפשט* / *הכל* — בחירת יעד למעקב",
    "• *יעדים* — מה פעיל אצלך",
    "• *עזרה* — התפריט הזה",
    "",
    "מעקב קבוע:",
    "🇹🇭 תאילנד · 10/02/2027–10/03/2027 · אמירטס + מזוודה",
    "🇭🇺 בודפשט · 11/11/2026–15/11/2026",
  ].join("\n");
}

export function personalStatusText(user, status = {}) {
  if (!user?.active) {
    return "אתה לא במעקב כרגע. כתוב *התחל* כדי להצטרף.";
  }
  const watches = normalizeWatches(user.watches);
  const thOn = watches.includes("thailand");
  const budOn = watches.includes("budapest");
  const th = status.thailand?.lowestIls;
  const bud = status.budapest?.lowestIls;
  const lines = [
    "✅ *מעקב אישי פעיל*",
    `📍 יעדים: *${formatWatchesHe(watches)}*`,
    `💰 תקרת תקציב: *₪${Math.round(user.maxPriceIls)}*`,
    "",
  ];

  if (thOn) {
    lines.push(
      "🇹🇭 תאילנד · אמירטס · מזוודה · 15:10→07:35",
      th != null ? `   מחיר נוכחי: *₪${Math.round(th)}*` : "   עדיין אין מחיר",
      user.lastAlertByWatch?.thailand != null
        ? `   התראה אחרונה: ₪${Math.round(user.lastAlertByWatch.thailand)}`
        : "",
      "",
    );
  } else {
    lines.push("🇹🇭 תאילנד — *כבוי*", "   כתוב *רק תאילנד* או *הכל* להפעלה", "");
  }

  if (budOn) {
    lines.push(
      "🇭🇺 בודפשט · 11/11/2026–15/11/2026",
      bud != null ? `   מחיר נוכחי: *₪${Math.round(bud)}*` : "   עדיין אין מחיר",
      user.lastAlertByWatch?.budapest != null
        ? `   התראה אחרונה: ₪${Math.round(user.lastAlertByWatch.budapest)}`
        : "",
      "",
    );
  } else {
    lines.push("🇭🇺 בודפשט — *כבוי*", "   כתוב *רק בודפשט* או *הכל* להפעלה", "");
  }

  lines.push("כתוב *מחפש* לחיפוש מיידי.");
  return lines.filter(Boolean).join("\n");
}

/** Parse destination-selection phrases → watch ids. */
export function parseWatchSelection(text) {
  const t = String(text ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[?؟！!.,，、~`'"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!t) return null;

  if (
    t === "הכל" ||
    t === "כל היעדים" ||
    t === "שניהם" ||
    t === "שתי הטיסות" ||
    t === "יעד הכל" ||
    t === "all"
  ) {
    return [...DEFAULT_WATCHES];
  }

  if (
    t === "רק תאילנד" ||
    t === "יעד תאילנד" ||
    t === "תאילנד בלבד" ||
    t === "רק תאי" ||
    t === "thailand only" ||
    t === "thailand"
  ) {
    return ["thailand"];
  }

  if (
    t === "רק בודפשט" ||
    t === "יעד בודפשט" ||
    t === "בודפשט בלבד" ||
    t === "רק הונגריה" ||
    t === "budapest only" ||
    t === "budapest" ||
    t === "bud"
  ) {
    return ["budapest"];
  }

  // "תאילנד ובודפשט" / "בודפשט ותאילנד"
  const hasTh = /תאילנד|thailand/.test(t);
  const hasBud = /בודפשט|הונגריה|budapest|\bbud\b/.test(t);
  if (hasTh && hasBud) return [...DEFAULT_WATCHES];

  return null;
}

export function normalizeCommandText(text) {
  return String(text ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[?؟！!.,，、~`'"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * @param {string} text
 * @param {{ looseStatus?: boolean }} [opts]
 * @returns {{ type: string, maxPriceIls?: number, watches?: string[] } | null}
 */
export function parsePersonalCommand(text, { looseStatus = true } = {}) {
  const t = normalizeCommandText(text);
  if (!t) return null;

  if (
    t === "התחל" ||
    t === "הצטרף" ||
    t === "start" ||
    t === "join" ||
    t.includes("תתחיל לעקוב") ||
    t === "כן תתחיל"
  ) {
    return { type: "start" };
  }
  if (t === "עצור" || t === "בטל" || t === "stop" || t === "unsubscribe") {
    return { type: "stop" };
  }
  if (
    t === "עזרה" ||
    t === "תפריט" ||
    t === "help" ||
    t === "תפריט בוט" ||
    t === "בוט"
  ) {
    return { type: "help" };
  }

  // Fixed Thailand watch: 10/02/2027–10/03/2027 · Emirates + free bag
  if (
    t === "תאילנד" ||
    t === "חפש תאילנד" ||
    t === "חיפוש תאילנד" ||
    t === "תאילנד עכשיו" ||
    t === "תאילנד אמירטס" ||
    t === "אמירטס" ||
    t === "אמירייטס" ||
    t === "emirates" ||
    t === "בוט תאילנד" ||
    t === "מזוודה תאילנד" ||
    t === "תאילנד מזוודה"
  ) {
    return { type: "search-thailand" };
  }

  if (t === "יעדים" || t === "יעד" || t === "watches" || t === "destinations") {
    return { type: "watches" };
  }

  const selected = parseWatchSelection(t);
  if (selected) {
    return { type: "set-watches", watches: selected };
  }

  if (
    t === "סטטוס" ||
    t === "מצב" ||
    t === "status" ||
    t === "מחפש" ||
    t.includes("בוט מחפש") ||
    (t.startsWith("בוט ") && t.includes("טיסות")) ||
    (looseStatus && t.includes("מחפש"))
  ) {
    return { type: "status" };
  }

  const budget = t.match(/^(?:תקציב|עד|מקס|max)\s*(\d{3,5})$/);
  if (budget) {
    return { type: "budget", maxPriceIls: Number(budget[1]) };
  }
  // Bare numbers only in DM — too noisy for group chat.
  if (looseStatus) {
    const budget2 = t.match(/^(\d{3,5})\s*(?:שקל|שח|₪)?$/);
    if (budget2 && Number(budget2[1]) >= 500 && Number(budget2[1]) <= 20000) {
      return { type: "budget", maxPriceIls: Number(budget2[1]) };
    }
  }

  return null;
}

/** Strict parser for group chat — avoids false positives on casual messages. */
export function parseGroupCommand(text) {
  return parsePersonalCommand(text, { looseStatus: false });
}

export function shouldAlertPersonalUser(user, deal) {
  if (!user?.active || !deal) return false;
  const watch = String(deal.watch ?? "");
  if (!user.watches?.includes(watch)) return false;
  const price = Number(deal.priceIls ?? deal.priceUsd);
  if (!Number.isFinite(price) || price <= 0) return false;
  if (price > Number(user.maxPriceIls)) return false;

  const last = user.lastAlertByWatch?.[watch];
  if (last == null) return true;

  const dropEnv =
    watch === "budapest"
      ? process.env.FLIGHT_DEALS_BUDAPEST_PRICE_DROP_ILS
      : process.env.FLIGHT_DEALS_THAILAND_PRICE_DROP_ILS;
  const dropIls = Number(dropEnv ?? (watch === "budapest" ? "50" : "100"));
  return price <= Number(last) - dropIls;
}
