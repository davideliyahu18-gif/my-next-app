/**
 * League standings (טבלה) from ESPN.
 */

import { hebrewTeamName } from "@/lib/team-display";
import {
  getEspnStandings,
  type EspnJson,
} from "@/src/football/espnLeaguesClient";

export type FootballStandingRow = {
  rank: number;
  teamName: string;
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  note?: string;
};

export type FootballStandingsTable = {
  leagueId: string;
  leagueName: string;
  seasonLabel: string | null;
  rows: FootballStandingRow[];
};

function asRecord(value: unknown): EspnJson | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as EspnJson)
    : null;
}

function statValue(
  stats: EspnJson[] | undefined,
  names: string[],
): number | null {
  if (!stats?.length) return null;
  for (const name of names) {
    const hit = stats.find((s) => String(s.name || "").toLowerCase() === name);
    if (!hit) continue;
    const raw = hit.value ?? hit.displayValue;
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function collectEntries(payload: EspnJson): EspnJson[] {
  const children = Array.isArray(payload.children)
    ? (payload.children as EspnJson[])
    : [];
  const entries: EspnJson[] = [];
  for (const child of children) {
    const standings = asRecord(child.standings);
    const list = Array.isArray(standings?.entries)
      ? (standings!.entries as EspnJson[])
      : [];
    entries.push(...list);
  }
  if (entries.length) return entries;

  const direct = asRecord(payload.standings);
  if (Array.isArray(direct?.entries)) {
    return direct!.entries as EspnJson[];
  }
  return [];
}

function seasonLabelFromPayload(payload: EspnJson): string | null {
  const season = asRecord(payload.season);
  if (!season) return null;
  const display = String(season.displayName || season.name || "").trim();
  const year = season.year != null ? String(season.year) : "";
  if (display) return display;
  return year || null;
}

export function parseEspnStandings(
  payload: EspnJson,
  options: { leagueId: string; leagueNameHe: string },
): FootballStandingsTable {
  const rows: FootballStandingRow[] = [];
  for (const entry of collectEntries(payload)) {
    const team = asRecord(entry.team) || {};
    const stats = Array.isArray(entry.stats)
      ? (entry.stats as EspnJson[])
      : [];
    const noteObj = asRecord(entry.note);
    const englishName = String(
      team.displayName || team.shortDisplayName || team.name || "",
    ).trim();
    if (!englishName) continue;

    const rank =
      statValue(stats, ["rank", "gamesbehind"]) ??
      rows.length + 1;
    rows.push({
      rank: Math.max(1, Math.trunc(rank)),
      teamName: hebrewTeamName(englishName) || englishName,
      teamId: String(team.id || ""),
      played: Math.trunc(statValue(stats, ["gamesplayed", "played"]) ?? 0),
      won: Math.trunc(statValue(stats, ["wins", "win"]) ?? 0),
      drawn: Math.trunc(statValue(stats, ["ties", "draws", "draw"]) ?? 0),
      lost: Math.trunc(statValue(stats, ["losses", "loss"]) ?? 0),
      goalsFor: Math.trunc(
        statValue(stats, ["pointsfor", "goalsfor", "for"]) ?? 0,
      ),
      goalsAgainst: Math.trunc(
        statValue(stats, ["pointsagainst", "goalsagainst", "against"]) ?? 0,
      ),
      goalDiff: Math.trunc(
        statValue(stats, ["pointdifferential", "goaldifferential", "gd"]) ??
          0,
      ),
      points: Math.trunc(statValue(stats, ["points", "pts"]) ?? 0),
      note: noteObj
        ? String(noteObj.description || noteObj.text || "").trim() || undefined
        : undefined,
    });
  }

  rows.sort((a, b) => a.rank - b.rank || b.points - a.points);

  return {
    leagueId: options.leagueId,
    leagueName: options.leagueNameHe,
    seasonLabel: seasonLabelFromPayload(payload),
    rows,
  };
}

export async function fetchLeagueStandings(
  leagueId: string,
  leagueNameHe: string,
): Promise<FootballStandingsTable> {
  const payload = await getEspnStandings(leagueId, { fresh: true });
  return parseEspnStandings(payload, { leagueId, leagueNameHe });
}

function formatGoalDiff(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

/** WhatsApp-friendly Hebrew standings message. */
export function formatStandingsMessage(
  table: FootballStandingsTable,
  options?: { limit?: number },
): string {
  const limit = options?.limit ?? 20;
  const lines = [
    `📊 *טבלה — ${table.leagueName}*`,
    table.seasonLabel ? `עונה: ${table.seasonLabel}` : null,
    "",
  ].filter((line): line is string => line != null);

  if (!table.rows.length) {
    lines.push("📭 אין נתוני טבלה כרגע לליגה הזו.");
    lines.push("");
    lines.push("כתבו *טבלה* לבחירת ליגה אחרת");
    return lines.join("\n");
  }

  const seasonNotStarted = table.rows.every((row) => row.played === 0);
  if (seasonNotStarted) {
    lines.push("_העונה עדיין לא התחילה — טבלה התחלתית_");
    lines.push("");
  }

  for (const row of table.rows.slice(0, limit)) {
    const gd = formatGoalDiff(row.goalDiff);
    lines.push(
      `*${row.rank}.* ${row.teamName} · ${row.played}מש׳ ${row.won}נצ׳ ${row.drawn}ת׳ ${row.lost}הפ׳ · ${gd} · *${row.points}נ׳*`,
    );
    // Pre-season ESPN attaches CL/EL slot notes by rank — skip until games are played.
    if (row.note && !seasonNotStarted) {
      lines.push(`   _${row.note}_`);
    }
  }

  if (table.rows.length > limit) {
    lines.push("");
    lines.push(`… ועוד ${table.rows.length - limit} קבוצות`);
  }

  lines.push("");
  lines.push("כתבו *טבלה* לבחירת ליגה אחרת");
  return lines.join("\n");
}
