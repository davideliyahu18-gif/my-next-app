/**
 * Private personal subscribers — each user chats with the bot in DM.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PERSONAL_USERS_FILE = path.join(__dirname, "personal-users.json");

/** @typedef {{
 *  active: boolean,
 *  watch: "thailand",
 *  maxPriceIls: number,
 *  lastAlertPriceIls: number|null,
 *  joinedAt: number,
 *  updatedAt: number,
 *  pushName?: string|null,
 * }} PersonalUser */

/** @type {Map<string, PersonalUser>} */
const users = new Map();

function defaultMaxPriceIls() {
  return Number(process.env.FLIGHT_DEALS_THAILAND_MAX_PRICE_ILS ?? "4500");
}

function normalizeUserJid(jid) {
  if (!jid) return "";
  // Strip device suffix: 9725...:12@s.whatsapp.net → 9725...@s.whatsapp.net
  const base = String(jid).split(":")[0];
  if (base.includes("@")) return base;
  return `${base}@s.whatsapp.net`;
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
        watch: "thailand",
        maxPriceIls: Number(user.maxPriceIls ?? defaultMaxPriceIls()),
        lastAlertPriceIls:
          user.lastAlertPriceIls == null ? null : Number(user.lastAlertPriceIls),
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
    watch: "thailand",
    maxPriceIls: defaultMaxPriceIls(),
    lastAlertPriceIls: null,
    joinedAt: Date.now(),
    updatedAt: Date.now(),
    pushName: null,
    ...(prev ?? {}),
    ...patch,
    updatedAt: Date.now(),
  };
  users.set(key, next);
  await savePersonalUsers();
  return next;
}

export function personalHelpText() {
  return [
    "👋 *בוט אישי לטיסות תאילנד*",
    "",
    "אני מתריע *רק אליך בפרטי* — לא בקבוצה.",
    "",
    "*פקודות:*",
    "• *התחל* — הצטרפות למעקב אמירטס + מזוודה",
    "• *עצור* — ביטול התראות",
    "• *סטטוס* / *מחפש* — חיפוש מחיר עכשיו",
    "• *תקציב 3200* — מקסימום בשקלים",
    "• *עזרה* — התפריט הזה",
    "",
    "מעקב קבוע:",
    "🇹🇭 תאילנד · 10/02/2027–10/03/2027",
    "🕕 יציאה 15:10→07:35 · חזרה בלילה",
    "🧳 אמירטס + מזוודה כלולה",
  ].join("\n");
}

export function personalStatusText(user, lowestIls = null) {
  if (!user?.active) {
    return "אתה לא במעקב כרגע. כתוב *התחל* כדי להצטרף.";
  }
  return [
    "✅ *מעקב אישי פעיל*",
    "🇹🇭 תאילנד · אמירטס · מזוודה · 15:10→07:35",
    `💰 תקרת תקציב: *₪${Math.round(user.maxPriceIls)}*`,
    user.lastAlertPriceIls != null
      ? `🔔 התראה אחרונה: *₪${Math.round(user.lastAlertPriceIls)}*`
      : "🔔 עדיין לא נשלחה התראת מחיר",
    lowestIls != null ? `📉 מחיר נוכחי במעקב: *₪${Math.round(lowestIls)}*` : "",
    "",
    "כתוב *מחפש* לחיפוש מיידי.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Parse a private DM command.
 * @returns {{ type: string, maxPriceIls?: number } | null}
 */
export function parsePersonalCommand(text) {
  const t = String(text ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[?؟！!.,，、~`'"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
  if (
    t === "סטטוס" ||
    t === "מצב" ||
    t.includes("בוט מחפש") ||
    t.includes("מחפש") ||
    t === "status"
  ) {
    return { type: "status" };
  }

  const budget = t.match(/^(?:תקציב|עד|מקס|max)\s*(\d{3,5})$/);
  if (budget) {
    return { type: "budget", maxPriceIls: Number(budget[1]) };
  }
  const budget2 = t.match(/^(\d{3,5})\s*(?:שקל|שח|₪)?$/);
  if (budget2 && Number(budget2[1]) >= 500 && Number(budget2[1]) <= 20000) {
    return { type: "budget", maxPriceIls: Number(budget2[1]) };
  }

  return null;
}

export function shouldAlertPersonalUser(user, deal) {
  if (!user?.active || !deal) return false;
  if (deal.watch !== "thailand") return false;
  const price = Number(deal.priceIls ?? deal.priceUsd);
  if (!Number.isFinite(price) || price <= 0) return false;
  if (price > Number(user.maxPriceIls)) return false;

  if (user.lastAlertPriceIls == null) return true;
  const dropIls = Number(process.env.FLIGHT_DEALS_THAILAND_PRICE_DROP_ILS ?? "100");
  return price <= Number(user.lastAlertPriceIls) - dropIls;
}
