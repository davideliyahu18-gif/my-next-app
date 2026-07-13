import { getLiveFootballMatch } from "./fifa-api";
import { filterKnockoutUpcoming } from "./knockout-stages";
import type {
  LineupPlayerView,
  ScheduleMatchView,
  SemiFinalLineupMatchView,
  TeamLineupView,
} from "./types";

const STARTER_STATUS = 1;
const POSITION_LABELS: Record<number, string> = {
  0: "שוער",
  1: "הגנה",
  2: "קישור",
  3: "התקפה",
};

type LocalizedItem = { Locale?: string; Description?: string };

function localizedName(
  items: LocalizedItem[] | null | undefined,
  preferredLocales: string[] = ["en", "he"],
): string {
  if (!items?.length) return "";
  for (const preferred of preferredLocales) {
    for (const item of items) {
      const locale = String(item.Locale ?? "").toLowerCase();
      if (locale.includes(preferred) && item.Description) {
        return String(item.Description);
      }
    }
  }
  return String(items[0]?.Description ?? "");
}

function parsePlayers(rawPlayers: unknown[]): LineupPlayerView[] {
  const players: LineupPlayerView[] = [];

  for (const raw of rawPlayers) {
    const entry = raw as Record<string, unknown>;
    const position = Number(entry.Position ?? 3);
    const status = Number(entry.Status ?? 0);
    const name =
      localizedName(entry.ShortName as LocalizedItem[] | undefined) ||
      localizedName(entry.PlayerName as LocalizedItem[] | undefined);
    if (!name) continue;

    players.push({
      id: String(entry.IdPlayer ?? name),
      name,
      shirtNumber:
        entry.ShirtNumber === null || entry.ShirtNumber === undefined
          ? null
          : Number(entry.ShirtNumber),
      position,
      positionLabel: POSITION_LABELS[position] ?? "שחקן",
      captain: Boolean(entry.Captain),
      starter: status === STARTER_STATUS,
    });
  }

  return players.sort((a, b) => {
    if (a.starter !== b.starter) return a.starter ? -1 : 1;
    if (a.position !== b.position) return a.position - b.position;
    return (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99);
  });
}

function parseTeamLineup(
  side: Record<string, unknown> | undefined,
  meta: {
    team: string;
    teamCode: string;
    flag: string;
    source: "official" | "last";
    sourceLabel: string;
  },
): TeamLineupView | null {
  if (!side) return null;
  const players = parsePlayers(
    (side.Players as unknown[] | undefined) ?? [],
  );
  if (!players.length) return null;

  const coaches = (side.Coaches as Record<string, unknown>[] | undefined) ?? [];
  const coach =
    localizedName(coaches[0]?.Name as LocalizedItem[] | undefined) ||
    localizedName(coaches[0]?.Alias as LocalizedItem[] | undefined) ||
    null;

  return {
    team: meta.team,
    teamCode: meta.teamCode,
    flag: meta.flag,
    formation: side.Tactics ? String(side.Tactics) : null,
    coach,
    starters: players.filter((player) => player.starter),
    substitutes: players.filter((player) => !player.starter),
    source: meta.source,
    sourceLabel: meta.sourceLabel,
  };
}

function findLastFinishedMatchId(
  schedule: ScheduleMatchView[],
  teamCode: string,
  beforeKickoff: string,
): string | null {
  const code = teamCode.toUpperCase();
  const before = new Date(beforeKickoff).getTime();

  const previous = schedule
    .filter((match) => match.status === "finished")
    .filter(
      (match) =>
        match.homeCode.toUpperCase() === code ||
        match.awayCode.toUpperCase() === code,
    )
    .filter((match) => new Date(match.kickoffAt).getTime() < before)
    .sort((a, b) => b.kickoffAt.localeCompare(a.kickoffAt));

  return previous[0]?.id ?? null;
}

async function lineupForTeam(options: {
  officialSide?: Record<string, unknown>;
  schedule: ScheduleMatchView[];
  team: string;
  teamCode: string;
  flag: string;
  beforeKickoff: string;
  fresh: boolean;
}): Promise<TeamLineupView | null> {
  const official = parseTeamLineup(options.officialSide, {
    team: options.team,
    teamCode: options.teamCode,
    flag: options.flag,
    source: "official",
    sourceLabel: "הרכב רשמי",
  });
  if (official?.starters.length) return official;

  const lastMatchId = findLastFinishedMatchId(
    options.schedule,
    options.teamCode,
    options.beforeKickoff,
  );
  if (!lastMatchId) return null;

  try {
    const live = await getLiveFootballMatch(lastMatchId, options.fresh);
    const home = (live.HomeTeam as Record<string, unknown> | undefined) ?? {};
    const away = (live.AwayTeam as Record<string, unknown> | undefined) ?? {};
    const homeCode = String(home.Abbreviation ?? "").toUpperCase();
    const awayCode = String(away.Abbreviation ?? "").toUpperCase();
    const code = options.teamCode.toUpperCase();
    const side =
      homeCode === code ? home : awayCode === code ? away : undefined;

    return parseTeamLineup(side, {
      team: options.team,
      teamCode: options.teamCode,
      flag: options.flag,
      source: "last",
      sourceLabel: "הרכב אחרון בטורניר",
    });
  } catch {
    return null;
  }
}

export async function fetchSemiFinalLineups(
  schedule: ScheduleMatchView[],
  fresh = false,
): Promise<SemiFinalLineupMatchView[]> {
  const { semiFinals } = filterKnockoutUpcoming(schedule);

  const results = await Promise.all(
    semiFinals.map(async (match) => {
      let live: Record<string, unknown> = {};
      try {
        live = await getLiveFootballMatch(match.id, fresh);
      } catch {
        live = {};
      }

      const homeSide = live.HomeTeam as Record<string, unknown> | undefined;
      const awaySide = live.AwayTeam as Record<string, unknown> | undefined;

      const [homeLineup, awayLineup] = await Promise.all([
        lineupForTeam({
          officialSide: homeSide,
          schedule,
          team: match.home,
          teamCode: match.homeCode,
          flag: match.homeFlag,
          beforeKickoff: match.kickoffAt,
          fresh,
        }),
        lineupForTeam({
          officialSide: awaySide,
          schedule,
          team: match.away,
          teamCode: match.awayCode,
          flag: match.awayFlag,
          beforeKickoff: match.kickoffAt,
          fresh,
        }),
      ]);

      return {
        id: match.id,
        home: match.home,
        homeFlag: match.homeFlag,
        homeCode: match.homeCode,
        away: match.away,
        awayFlag: match.awayFlag,
        awayCode: match.awayCode,
        kickoffAt: match.kickoffAt,
        dateLabel: match.dateLabel,
        timeLabel: match.timeLabel,
        venue: match.venue,
        status: match.status,
        homeLineup,
        awayLineup,
      } satisfies SemiFinalLineupMatchView;
    }),
  );

  return results;
}
