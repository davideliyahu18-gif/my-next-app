/**
 * Team squad / roster (סגל שחקנים) from ESPN.
 */

import {
  getEspnTeamRoster,
  type EspnJson,
} from "@/src/football/espnLeaguesClient";

export type FootballRosterPlayer = {
  id: string;
  name: string;
  /** Hebrew nickname / short name when known. */
  nameHe: string | null;
  jersey: string | null;
  position: string;
  positionHe: string;
  age: number | null;
  /** Summer / recent signing highlight. */
  isNewSigning: boolean;
};

export type FootballTeamRoster = {
  teamName: string;
  teamNameHe: string;
  leagueId: string;
  seasonLabel: string | null;
  players: FootballRosterPlayer[];
};

const POSITION_HE: Record<string, string> = {
  goalkeeper: "שוערים",
  defender: "הגנה",
  midfielder: "קישור",
  forward: "התקפה",
  attacker: "התקפה",
};

const POSITION_ORDER = ["שוערים", "הגנה", "קישור", "התקפה", "אחר"];

/** Hebrew display names for notable players (esp. new Barça signings). */
const PLAYER_NAME_HE: Record<string, string> = {
  "karim adeyemi": "אדיימי",
  "anthony gordon": "גורדון",
  "lamine yamal": "למין ימאל",
  raphinha: "רפיניה",
  "ferran torres": "פראן טורס",
  "robert lewandowski": "לבנדובסקי",
  pedri: "פדרי",
  gavi: "גאבי",
  "frenkie de jong": "דה יונג",
  "dani olmo": "דני אולמו",
  "ronald araújo": "אראוחו",
  "ronald araujo": "אראוחו",
  "pau cubarsí": "קובארסי",
  "pau cubarsi": "קובארסי",
  "alejandro balde": "באלדה",
  "jules koundé": "קונדה",
  "jules kounde": "קונדה",
  "marc-andré ter stegen": "טר שטגן",
  "marc-andre ter stegen": "טר שטגן",
  "wojciech szczesny": "שצ'סני",
  "joan garcía": "חואן גרסיה",
  "joan garcia": "חואן גרסיה",
  "roony bardghji": "בארדג'י",
};

/** Players signed this window — shown first + 🆕 badge. */
const NEW_SIGNING_KEYS = new Set([
  "karim adeyemi",
  "anthony gordon",
]);

function asRecord(value: unknown): EspnJson | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as EspnJson)
    : null;
}

function normalizePlayerKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['׳״`]/g, "");
}

function playerNameHe(name: string): string | null {
  const key = normalizePlayerKey(name);
  return PLAYER_NAME_HE[key] ?? PLAYER_NAME_HE[name.trim().toLowerCase()] ?? null;
}

function isNewSigning(name: string): boolean {
  const key = normalizePlayerKey(name);
  return NEW_SIGNING_KEYS.has(key) || NEW_SIGNING_KEYS.has(name.trim().toLowerCase());
}

function displayPlayerName(player: FootballRosterPlayer): string {
  if (player.nameHe) return `${player.nameHe} (${player.name})`;
  return player.name;
}

function positionHe(raw: string): string {
  const key = raw.trim().toLowerCase();
  return POSITION_HE[key] || "אחר";
}

function collectAthletes(payload: EspnJson): EspnJson[] {
  const athletes = payload.athletes;
  if (!Array.isArray(athletes)) return [];

  // Flat list of players
  if (athletes.length && asRecord(athletes[0])?.displayName) {
    return athletes as EspnJson[];
  }

  // Grouped: [{ position, items: [...] }]
  const flat: EspnJson[] = [];
  for (const group of athletes) {
    const row = asRecord(group);
    const items = Array.isArray(row?.items) ? (row!.items as EspnJson[]) : [];
    flat.push(...items);
  }
  return flat;
}

export function parseEspnRoster(
  payload: EspnJson,
  options: { teamNameHe: string; leagueId: string },
): FootballTeamRoster {
  const team = asRecord(payload.team) || {};
  const season = asRecord(payload.season);
  const players: FootballRosterPlayer[] = [];

  for (const athlete of collectAthletes(payload)) {
    const position = asRecord(athlete.position) || {};
    const posEn = String(
      position.displayName || position.name || position.abbreviation || "",
    ).trim();
    const name = String(
      athlete.displayName || athlete.fullName || athlete.shortName || "",
    ).trim();
    if (!name) continue;
    const jerseyRaw = athlete.jersey;
    const jersey =
      jerseyRaw != null && String(jerseyRaw).trim() !== ""
        ? String(jerseyRaw).trim()
        : null;
    const ageNum = Number(athlete.age);
    players.push({
      id: String(athlete.id || name),
      name,
      nameHe: playerNameHe(name),
      jersey,
      position: posEn || "Unknown",
      positionHe: positionHe(posEn),
      age: Number.isFinite(ageNum) ? Math.trunc(ageNum) : null,
      isNewSigning: isNewSigning(name),
    });
  }

  players.sort((a, b) => {
    const ai = POSITION_ORDER.indexOf(a.positionHe);
    const bi = POSITION_ORDER.indexOf(b.positionHe);
    if (ai !== bi) return ai - bi;
    // New signings first within the group (Adeyemi / Gordon visible).
    if (a.isNewSigning !== b.isNewSigning) return a.isNewSigning ? -1 : 1;
    const aj = a.jersey ? Number(a.jersey) : 999;
    const bj = b.jersey ? Number(b.jersey) : 999;
    if (Number.isFinite(aj) && Number.isFinite(bj) && aj !== bj) return aj - bj;
    return a.name.localeCompare(b.name);
  });

  return {
    teamName: String(team.displayName || team.name || options.teamNameHe),
    teamNameHe: options.teamNameHe,
    leagueId: options.leagueId,
    seasonLabel: season
      ? String(season.displayName || season.year || "").trim() || null
      : null,
    players,
  };
}

export async function fetchTeamRoster(options: {
  leagueId: string;
  espnTeamId: string;
  teamNameHe: string;
}): Promise<FootballTeamRoster> {
  const payload = await getEspnTeamRoster(options.leagueId, options.espnTeamId, {
    fresh: true,
  });
  return parseEspnRoster(payload, {
    teamNameHe: options.teamNameHe,
    leagueId: options.leagueId,
  });
}

/** WhatsApp text roster, grouped by position. */
export function formatRosterMessage(roster: FootballTeamRoster): string {
  const lines = [
    `🧍 *סגל — ${roster.teamNameHe}*`,
    roster.seasonLabel ? `עונה: ${roster.seasonLabel}` : null,
    `⭐ במעקב · ${roster.players.length} שחקנים`,
    "",
  ].filter((line): line is string => line != null);

  if (!roster.players.length) {
    lines.push("📭 לא נמצא סגל עדכני כרגע.");
    return lines.join("\n");
  }

  const newcomers = roster.players.filter((player) => player.isNewSigning);
  if (newcomers.length) {
    lines.push(
      `🆕 רכש חדש: ${newcomers
        .map((player) => player.nameHe || player.name)
        .join(" · ")}`,
    );
    lines.push("");
  }

  let currentPos = "";
  for (const player of roster.players) {
    if (player.positionHe !== currentPos) {
      currentPos = player.positionHe;
      lines.push(`*${currentPos}*`);
    }
    const badge = player.isNewSigning ? "🆕 " : "";
    const num = player.jersey ? `#${player.jersey}` : "#—";
    const age = player.age != null ? ` · ${player.age}` : "";
    lines.push(`${badge}${num} ${displayPlayerName(player)}${age}`);
  }

  lines.push("");
  lines.push("כתבו *סגל ברצלונה* או *מעקב*");
  return lines.join("\n");
}
