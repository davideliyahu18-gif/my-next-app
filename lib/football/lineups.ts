/**
 * Parse ESPN soccer lineups / rosters for WhatsApp alerts + הרכב command.
 */

import { getEspnSummary, type EspnJson } from "@/src/football/espnLeaguesClient";
import type { FootballMatch } from "@/lib/football/source";

export interface FootballLineupPlayer {
  name: string;
  jersey: string | null;
  position: string | null;
  starter: boolean;
}

export interface FootballTeamLineup {
  team: string;
  formation: string | null;
  starters: FootballLineupPlayer[];
  substitutes: FootballLineupPlayer[];
}

export interface FootballMatchLineups {
  matchId: string;
  home: FootballTeamLineup | null;
  away: FootballTeamLineup | null;
  available: boolean;
}

function parseEspnEventId(matchId: string): { leagueId: string; eventId: string } | null {
  // espn:eng.1:401879301
  const parts = matchId.split(":");
  if (parts[0] !== "espn" || parts.length < 3) return null;
  return { leagueId: parts[1], eventId: parts.slice(2).join(":") };
}

function athleteName(entry: EspnJson): string {
  const athlete = (entry.athlete as EspnJson | undefined) ?? {};
  return String(
    athlete.displayName ??
      athlete.shortName ??
      athlete.fullName ??
      entry.displayName ??
      "",
  ).trim();
}

function positionLabel(entry: EspnJson): string | null {
  const position = (entry.position as EspnJson | undefined) ?? {};
  const label = String(
    position.abbreviation ?? position.displayName ?? position.name ?? "",
  ).trim();
  return label || null;
}

function parseSideRoster(side: EspnJson): FootballTeamLineup | null {
  const team = (side.team as EspnJson | undefined) ?? {};
  const teamName = String(team.displayName ?? team.shortDisplayName ?? "").trim();
  const roster = (side.roster as EspnJson[] | undefined) ?? [];
  if (!teamName || !roster.length) return null;

  const players: FootballLineupPlayer[] = [];
  for (const entry of roster) {
    const name = athleteName(entry);
    if (!name) continue;
    const jerseyRaw = entry.jersey;
    players.push({
      name,
      jersey:
        jerseyRaw == null || String(jerseyRaw).trim() === ""
          ? null
          : String(jerseyRaw),
      position: positionLabel(entry),
      starter: Boolean(entry.starter),
    });
  }

  if (!players.length) return null;

  const formationRaw = side.formation;
  return {
    team: teamName,
    formation:
      formationRaw == null || String(formationRaw).trim() === ""
        ? null
        : String(formationRaw),
    starters: players.filter((p) => p.starter).slice(0, 11),
    substitutes: players.filter((p) => !p.starter).slice(0, 9),
  };
}

export function parseEspnLineups(
  summary: EspnJson,
  matchId: string,
): FootballMatchLineups {
  const rosters = (summary.rosters as EspnJson[] | undefined) ?? [];
  let home: FootballTeamLineup | null = null;
  let away: FootballTeamLineup | null = null;

  for (const side of rosters) {
    const parsed = parseSideRoster(side);
    if (!parsed) continue;
    if (side.homeAway === "home") home = parsed;
    else if (side.homeAway === "away") away = parsed;
    else if (!home) home = parsed;
    else if (!away) away = parsed;
  }

  const available = Boolean(
    (home?.starters.length ?? 0) >= 7 || (away?.starters.length ?? 0) >= 7,
  );

  return { matchId, home, away, available };
}

export async function fetchMatchLineups(
  match: Pick<FootballMatch, "id" | "provider">,
  fresh = true,
): Promise<FootballMatchLineups | null> {
  if (match.provider !== "espn") return null;
  const parsed = parseEspnEventId(match.id);
  if (!parsed) return null;

  try {
    const summary = await getEspnSummary(parsed.leagueId, parsed.eventId, {
      fresh,
    });
    return parseEspnLineups(summary, match.id);
  } catch {
    return null;
  }
}

export function formatTeamLineupBlock(lineup: FootballTeamLineup): string[] {
  const lines: string[] = [];
  const formation = lineup.formation ? ` (${lineup.formation})` : "";
  lines.push(`*${lineup.team}*${formation}`);
  if (!lineup.starters.length) {
    lines.push("עדיין אין הרכב");
    return lines;
  }
  const starters = lineup.starters
    .map((p) => (p.jersey ? `${p.jersey}. ${p.name}` : p.name))
    .join(", ");
  lines.push(starters);
  return lines;
}

export function formatMatchLineupsMessage(
  match: Pick<FootballMatch, "homeTeam" | "awayTeam" | "competition">,
  lineups: FootballMatchLineups,
  options?: { title?: string },
): string {
  const title = options?.title ?? "🧍 *הרכבים*";
  if (!lineups.available) {
    return [
      title,
      "",
      `🏟️ *${match.homeTeam}* נגד *${match.awayTeam}*`,
      `🏆 ${match.competition}`,
      "",
      "הרכבים עדיין לא פורסמו.",
      "נשלח אוטומטית בתזכורת לפני המשחק כשיהיו.",
    ].join("\n");
  }

  const lines = [
    title,
    "",
    `🏟️ *${match.homeTeam}* נגד *${match.awayTeam}*`,
    `🏆 ${match.competition}`,
    "",
  ];

  if (lineups.home) {
    lines.push(...formatTeamLineupBlock(lineups.home));
    lines.push("");
  }
  if (lineups.away) {
    lines.push(...formatTeamLineupBlock(lineups.away));
  }

  return lines.filter((line, index, arr) => !(line === "" && arr[index - 1] === "")).join("\n").trim();
}
