import {
  FOOTBALL_LEAGUES,
  LEAGUE_BY_ID,
  getLeagueIdsCsv,
  type FootballLeague,
} from "./competitions";
export type { FootballLeague } from "./competitions";
import {
  getScores365Games,
  getScores365Standings,
  type Scores365Json,
} from "./scores365-client";

export type LeagueMatchStatus = "live" | "upcoming" | "finished";

export interface LeagueMatchView {
  id: string;
  leagueId: number;
  leagueSlug: string;
  leagueName: string;
  leagueFlag: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: LeagueMatchStatus;
  statusLabel: string;
  minute: string;
  kickoffAt: string;
  dateLabel: string;
  timeLabel: string;
  roundLabel: string | null;
}

export interface LeagueStandingRowView {
  rank: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  gd: number;
  points: number;
}

export interface LeagueStandingsView {
  leagueId: number;
  leagueSlug: string;
  leagueName: string;
  leagueFlag: string;
  seasonLabel: string | null;
  rows: LeagueStandingRowView[];
}

export interface LeaguesDashboardView {
  leagues: FootballLeague[];
  matchesByLeague: Record<string, LeagueMatchView[]>;
  standings: LeagueStandingsView[];
  liveMatches: LeagueMatchView[];
  nextMatch: LeagueMatchView | null;
  fetchedAt: string;
}

function asRecord(value: unknown): Scores365Json | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Scores365Json)
    : null;
}

function parseScore(value: unknown): number | null {
  if (value == null || value === "" || value === -1 || value === -1.0) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function mapStatus(
  statusGroup: number,
  statusText: string,
): { status: LeagueMatchStatus; label: string } {
  const text = statusText.trim();
  if (statusGroup === 3 || /חי|live|שידור/i.test(text)) {
    return { status: "live", label: text || "LIVE" };
  }
  if (
    statusGroup === 4 ||
    /הסתיים|סיום|final|finished/i.test(text)
  ) {
    return { status: "finished", label: text || "הסתיים" };
  }
  return { status: "upcoming", label: text || "טרם החל" };
}

function formatKickoff(iso: string): { dateLabel: string; timeLabel: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { dateLabel: "", timeLabel: "" };
  }
  return {
    dateLabel: date.toLocaleDateString("he-IL", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "Asia/Jerusalem",
    }),
    timeLabel: date.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    }),
  };
}

function parseGame(game: Scores365Json, league: FootballLeague): LeagueMatchView | null {
  const id = String(game.id ?? "");
  if (!id) return null;

  const home = asRecord(game.homeCompetitor) ?? {};
  const away = asRecord(game.awayCompetitor) ?? {};
  const homeName = String(home.name ?? "").trim();
  const awayName = String(away.name ?? "").trim();
  if (!homeName || !awayName) return null;

  const statusGroup = Number(game.statusGroup ?? 0);
  const statusText = String(game.statusText ?? game.shortStatusText ?? "");
  const mapped = mapStatus(statusGroup, statusText);
  const kickoffAt = String(game.startTime ?? "");
  const { dateLabel, timeLabel } = formatKickoff(kickoffAt);

  const gameTime = game.gameTime;
  const minute =
    mapped.status === "live" && gameTime != null && Number(gameTime) > 0
      ? `${Math.trunc(Number(gameTime))}'`
      : mapped.status === "finished"
        ? "סיום"
        : timeLabel || "—";

  return {
    id,
    leagueId: league.id,
    leagueSlug: league.slug,
    leagueName: league.nameHe,
    leagueFlag: league.countryFlag,
    home: homeName,
    away: awayName,
    homeScore: parseScore(home.score),
    awayScore: parseScore(away.score),
    status: mapped.status,
    statusLabel: mapped.label,
    minute,
    kickoffAt,
    dateLabel,
    timeLabel,
    roundLabel: game.roundName ? String(game.roundName) : null,
  };
}

function parseStandingsPayload(
  payload: Scores365Json,
  league: FootballLeague,
): LeagueStandingsView {
  const standingsBlocks = Array.isArray(payload.standings)
    ? (payload.standings as Scores365Json[])
    : [];
  const block = standingsBlocks[0] ?? {};
  const rowsRaw = Array.isArray(block.rows)
    ? (block.rows as Scores365Json[])
    : [];

  const rows: LeagueStandingRowView[] = rowsRaw
    .map((row) => {
      const competitor = asRecord(row.competitor) ?? {};
      const teamName = String(competitor.name ?? "").trim();
      if (!teamName) return null;

      const goalsFor = Math.trunc(Number(row.for ?? 0));
      const goalsAgainst = Math.trunc(Number(row.against ?? 0));
      const gd =
        row.ratio != null
          ? Math.trunc(Number(row.ratio))
          : goalsFor - goalsAgainst;

      return {
        rank: Math.trunc(Number(row.position ?? 0)) || 0,
        teamName,
        played: Math.trunc(Number(row.gamePlayed ?? 0)),
        won: Math.trunc(Number(row.gamesWon ?? 0)),
        drawn: Math.trunc(Number(row.gamesEven ?? 0)),
        lost: Math.trunc(Number(row.gamesLost ?? 0)),
        goalsFor,
        goalsAgainst,
        gd,
        points: Math.trunc(Number(row.points ?? 0)),
      };
    })
    .filter((row): row is LeagueStandingRowView => Boolean(row))
    .sort((a, b) => a.rank - b.rank || b.points - a.points);

  const season = asRecord(payload.season);
  const seasonLabel = season
    ? String(season.displayName ?? season.name ?? "").trim() || null
    : null;

  return {
    leagueId: league.id,
    leagueSlug: league.slug,
    leagueName: league.nameHe,
    leagueFlag: league.countryFlag,
    seasonLabel,
    rows,
  };
}

function addDays(base: Date, days: number): Date {
  const copy = new Date(base);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function groupMatchesByLeague(matches: LeagueMatchView[]): Record<string, LeagueMatchView[]> {
  const grouped: Record<string, LeagueMatchView[]> = {};
  for (const league of FOOTBALL_LEAGUES) {
    grouped[league.slug] = [];
  }
  for (const match of matches) {
    if (!grouped[match.leagueSlug]) grouped[match.leagueSlug] = [];
    grouped[match.leagueSlug].push(match);
  }
  for (const slug of Object.keys(grouped)) {
    grouped[slug].sort(
      (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
    );
  }
  return grouped;
}

function pickBoardMatches(matches: LeagueMatchView[]): LeagueMatchView[] {
  const now = Date.now();
  const live = matches.filter((match) => match.status === "live");
  const upcoming = matches
    .filter((match) => match.status === "upcoming")
    .filter((match) => new Date(match.kickoffAt).getTime() >= now - 30 * 60 * 1000);
  const recent = matches
    .filter((match) => match.status === "finished")
    .sort(
      (a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime(),
    )
    .slice(0, 4);

  const board = [...live, ...upcoming.slice(0, 8), ...recent];
  const seen = new Set<string>();
  return board.filter((match) => {
    if (seen.has(match.id)) return false;
    seen.add(match.id);
    return true;
  });
}

export async function fetchLeaguesDashboard(
  fresh = false,
): Promise<LeaguesDashboardView> {
  const now = new Date();
  const start = addDays(now, -3);
  const end = addDays(now, 14);

  const [gamesPayload, ...standingsPayloads] = await Promise.all([
    getScores365Games({
      competitionIds: getLeagueIdsCsv(),
      startDate: start,
      endDate: end,
      fresh,
    }),
    ...FOOTBALL_LEAGUES.map((league) =>
      getScores365Standings(league.id, { fresh }).catch(() => ({ standings: [] })),
    ),
  ]);

  const games = Array.isArray(gamesPayload.games)
    ? (gamesPayload.games as Scores365Json[])
    : [];

  const allMatches: LeagueMatchView[] = [];
  for (const game of games) {
    const competitionId = Number(game.competitionId ?? 0);
    const league = LEAGUE_BY_ID.get(competitionId);
    if (!league) continue;
    const parsed = parseGame(game, league);
    if (parsed) allMatches.push(parsed);
  }

  const matchesByLeague: Record<string, LeagueMatchView[]> = {};
  for (const league of FOOTBALL_LEAGUES) {
    const leagueMatches = allMatches.filter((match) => match.leagueId === league.id);
    matchesByLeague[league.slug] = pickBoardMatches(leagueMatches);
  }

  const liveMatches = allMatches
    .filter((match) => match.status === "live")
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

  const nextMatch =
    allMatches
      .filter((match) => match.status === "upcoming")
      .sort(
        (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
      )[0] ?? null;

  const standings = FOOTBALL_LEAGUES.map((league, index) =>
    parseStandingsPayload(standingsPayloads[index] as Scores365Json, league),
  );

  return {
    leagues: FOOTBALL_LEAGUES,
    matchesByLeague,
    standings,
    liveMatches,
    nextMatch,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchLeagueSchedule(
  fresh = false,
): Promise<LeaguesDashboardView> {
  const now = new Date();
  const start = addDays(now, -7);
  const end = addDays(now, 21);

  const gamesPayload = await getScores365Games({
    competitionIds: getLeagueIdsCsv(),
    startDate: start,
    endDate: end,
    fresh,
  });

  const games = Array.isArray(gamesPayload.games)
    ? (gamesPayload.games as Scores365Json[])
    : [];

  const allMatches: LeagueMatchView[] = [];
  for (const game of games) {
    const competitionId = Number(game.competitionId ?? 0);
    const league = LEAGUE_BY_ID.get(competitionId);
    if (!league) continue;
    const parsed = parseGame(game, league);
    if (parsed) allMatches.push(parsed);
  }

  return {
    leagues: FOOTBALL_LEAGUES,
    matchesByLeague: groupMatchesByLeague(allMatches),
    standings: [],
    liveMatches: allMatches.filter((match) => match.status === "live"),
    nextMatch: null,
    fetchedAt: new Date().toISOString(),
  };
}
