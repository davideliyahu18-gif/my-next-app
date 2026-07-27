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
  jersey: string | null;
  position: string;
  positionHe: string;
  age: number | null;
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

function asRecord(value: unknown): EspnJson | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as EspnJson)
    : null;
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
      jersey,
      position: posEn || "Unknown",
      positionHe: positionHe(posEn),
      age: Number.isFinite(ageNum) ? Math.trunc(ageNum) : null,
    });
  }

  players.sort((a, b) => {
    const ai = POSITION_ORDER.indexOf(a.positionHe);
    const bi = POSITION_ORDER.indexOf(b.positionHe);
    if (ai !== bi) return ai - bi;
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

  let currentPos = "";
  for (const player of roster.players) {
    if (player.positionHe !== currentPos) {
      currentPos = player.positionHe;
      lines.push(`*${currentPos}*`);
    }
    const num = player.jersey ? `#${player.jersey}` : "#—";
    const age = player.age != null ? ` · ${player.age}` : "";
    lines.push(`${num} ${player.name}${age}`);
  }

  lines.push("");
  lines.push("כתבו *סגל ברצלונה* או *מעקב*");
  return lines.join("\n");
}
