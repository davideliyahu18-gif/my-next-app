/**
 * Watched teams for football WhatsApp alerts.
 * When the list is non-empty, auto alerts (goal/reminder/lineup/…)
 * are limited to matches involving a watched team.
 */

import { Redis } from "@upstash/redis";
import type { FootballMatch } from "@/lib/football/source";

export interface WatchedTeam {
  id: string;
  nameHe: string;
  nameEn: string;
  aliases: string[];
  leagueId?: string;
  addedAt: string;
}

const WATCHLIST_KEY = "football-bot:watchlist";

declare global {
  var __footballBotWatchlist: WatchedTeam[] | undefined;
  var __footballBotRedisWatch: Redis | undefined;
}

/** Built-in catalog for quick Hebrew follow commands. */
export const KNOWN_TEAMS: Omit<WatchedTeam, "addedAt">[] = [
  {
    id: "barcelona",
    nameHe: "ברצלונה",
    nameEn: "Barcelona",
    aliases: [
      "ברצלונה",
      "ברסה",
      "barcelona",
      "barca",
      "fc barcelona",
      "fcb",
    ],
    leagueId: "esp.1",
  },
  {
    id: "real-madrid",
    nameHe: "ריאל מדריד",
    nameEn: "Real Madrid",
    aliases: ["ריאל", "ריאל מדריד", "real madrid", "madrid", "rmcf"],
    leagueId: "esp.1",
  },
  {
    id: "maccabi-tel-aviv",
    nameHe: "מכבי תל אביב",
    nameEn: "Maccabi Tel-Aviv",
    aliases: ["מכבי תל אביב", "מכבי ת\"א", "מכבי", "maccabi tel-aviv", "mta"],
    leagueId: "isr.1",
  },
  {
    id: "maccabi-haifa",
    nameHe: "מכבי חיפה",
    nameEn: "Maccabi Haifa",
    aliases: ["מכבי חיפה", "maccabi haifa"],
    leagueId: "isr.1",
  },
  {
    id: "arsenal",
    nameHe: "ארסנל",
    nameEn: "Arsenal",
    aliases: ["ארסנל", "arsenal", "afc"],
    leagueId: "eng.1",
  },
  {
    id: "chelsea",
    nameHe: "צ'לסי",
    nameEn: "Chelsea",
    aliases: ["צ'לסי", "צ׳לסי", "chelsea"],
    leagueId: "eng.1",
  },
  {
    id: "liverpool",
    nameHe: "ליברפול",
    nameEn: "Liverpool",
    aliases: ["ליברפול", "liverpool", "lfc"],
    leagueId: "eng.1",
  },
  {
    id: "man-city",
    nameHe: "מנצ'סטר סיטי",
    nameEn: "Manchester City",
    aliases: ["סיטי", "מנצ'סטר סיטי", "manchester city", "man city", "mcfc"],
    leagueId: "eng.1",
  },
  {
    id: "man-united",
    nameHe: "מנצ'סטר יונייטד",
    nameEn: "Manchester United",
    aliases: ["יונייטד", "מנצ'סטר יונייטד", "manchester united", "man utd", "mufc"],
    leagueId: "eng.1",
  },
  {
    id: "inter",
    nameHe: "אינטר",
    nameEn: "Internazionale",
    aliases: ["אינטר", "inter", "internazionale", "inter milan"],
    leagueId: "ita.1",
  },
  {
    id: "juventus",
    nameHe: "יובנטוס",
    nameEn: "Juventus",
    aliases: ["יובנטוס", "יובה", "juventus", "juve"],
    leagueId: "ita.1",
  },
  {
    id: "ac-milan",
    nameHe: "מילאן",
    nameEn: "AC Milan",
    aliases: ["מילאן", "milan", "ac milan"],
    leagueId: "ita.1",
  },
];

function normalizeTeamText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/['׳״"`]/g, "")
    .replace(/[?!.,]/g, "")
    .replace(/\s+/g, " ");
}

function isRedisConfigured(): boolean {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token);
}

function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (!globalThis.__footballBotRedisWatch) {
    globalThis.__footballBotRedisWatch = Redis.fromEnv();
  }
  return globalThis.__footballBotRedisWatch;
}

function memoryWatchlist(): WatchedTeam[] {
  if (!globalThis.__footballBotWatchlist) {
    globalThis.__footballBotWatchlist = [];
  }
  return globalThis.__footballBotWatchlist;
}

export async function loadWatchlist(): Promise<WatchedTeam[]> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<WatchedTeam[]>(WATCHLIST_KEY);
    return Array.isArray(raw) ? raw : [];
  }
  return [...memoryWatchlist()];
}

async function saveWatchlist(teams: WatchedTeam[]): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(WATCHLIST_KEY, teams);
    return;
  }
  globalThis.__footballBotWatchlist = teams;
}

export function resolveKnownTeam(raw: string): Omit<WatchedTeam, "addedAt"> | null {
  const query = normalizeTeamText(raw);
  if (!query) return null;

  for (const team of KNOWN_TEAMS) {
    const aliases = [team.nameHe, team.nameEn, ...team.aliases].map(normalizeTeamText);
    if (aliases.some((alias) => alias === query || query.includes(alias) || alias.includes(query))) {
      return team;
    }
  }
  return null;
}

export async function addWatchedTeam(raw: string): Promise<{
  ok: boolean;
  team?: WatchedTeam;
  already?: boolean;
  error?: string;
}> {
  const known = resolveKnownTeam(raw);
  if (!known) {
    return {
      ok: false,
      error:
        "לא זיהיתי את הקבוצה.\nנסו למשל: *ברצלונה* · *ארסנל* · *מכבי חיפה* · *אינטר*",
    };
  }

  const list = await loadWatchlist();
  if (list.some((team) => team.id === known.id)) {
    const existing = list.find((team) => team.id === known.id)!;
    return { ok: true, team: existing, already: true };
  }

  const team: WatchedTeam = { ...known, addedAt: new Date().toISOString() };
  list.push(team);
  await saveWatchlist(list);
  return { ok: true, team };
}

export async function removeWatchedTeam(raw: string): Promise<{
  ok: boolean;
  team?: WatchedTeam;
  error?: string;
}> {
  const known = resolveKnownTeam(raw);
  const list = await loadWatchlist();
  if (!known) {
    const query = normalizeTeamText(raw);
    const index = list.findIndex((team) => {
      const aliases = [team.nameHe, team.nameEn, ...team.aliases].map(
        normalizeTeamText,
      );
      return aliases.some((alias) => alias === query || query.includes(alias));
    });
    if (index === -1) {
      return { ok: false, error: "הקבוצה לא במעקב." };
    }
    const [removed] = list.splice(index, 1);
    await saveWatchlist(list);
    return { ok: true, team: removed };
  }

  const next = list.filter((team) => team.id !== known.id);
  if (next.length === list.length) {
    return { ok: false, error: `${known.nameHe} לא במעקב.` };
  }
  await saveWatchlist(next);
  return {
    ok: true,
    team: { ...known, addedAt: new Date().toISOString() },
  };
}

export function matchInvolvesWatchedTeam(
  match: Pick<FootballMatch, "homeTeam" | "awayTeam">,
  watchlist: WatchedTeam[],
): boolean {
  if (!watchlist.length) return true;
  const home = normalizeTeamText(match.homeTeam);
  const away = normalizeTeamText(match.awayTeam);

  return watchlist.some((team) => {
    const aliases = [team.nameHe, team.nameEn, ...team.aliases].map(
      normalizeTeamText,
    );
    return aliases.some(
      (alias) =>
        alias.length >= 3 &&
        (home.includes(alias) ||
          away.includes(alias) ||
          alias.includes(home) ||
          alias.includes(away)),
    );
  });
}

export function formatWatchlistMessage(teams: WatchedTeam[]): string {
  if (!teams.length) {
    return [
      "⭐ *מעקב קבוצות*",
      "",
      "אין קבוצות במעקב.",
      "כתבו למשל: *עקוב ברצלונה*",
      "",
      "כשיש מעקב — תזכורות/שערים/הרכבים נשלחים בעיקר לקבוצות האלה.",
    ].join("\n");
  }

  const lines = ["⭐ *מעקב קבוצות*", ""];
  for (const team of teams) {
    lines.push(`• *${team.nameHe}* (${team.nameEn})`);
  }
  lines.push("");
  lines.push("הוספה: *עקוב ארסנל*");
  lines.push("הסרה: *הסר ברצלונה*");
  return lines.join("\n");
}

export function extractFollowQuery(raw: string): string | null {
  const text = normalizeTeamText(raw);
  for (const prefix of ["עקוב אחרי", "עקוב", "מעקב אחרי", "follow", "watch"]) {
    if (text === prefix) return "";
    if (text.startsWith(`${prefix} `)) return text.slice(prefix.length).trim();
  }
  return null;
}

export function extractUnfollowQuery(raw: string): string | null {
  const text = normalizeTeamText(raw);
  for (const prefix of ["הסר מעקב", "הסר", "בטל מעקב", "unfollow", "unwatch"]) {
    if (text === prefix) return "";
    if (text.startsWith(`${prefix} `)) return text.slice(prefix.length).trim();
  }
  return null;
}
