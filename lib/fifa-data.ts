import { IMAGES, TOURNAMENT_META } from "./constants";
import {
  type FifaMatch,
  calendarTeamLabels,
  calendarRowToMatch,
  getCalendarMatches,
  getCalendarRowsById,
  getLiveMatchesNow,
  getMatchById,
  getMatchesByIds,
  getNextScheduledKickoffMatches,
  isPlaceholderScorer,
  latestMatchMinuteLabel,
  parseDatetime,
} from "./fifa-api";
import { countryFlag } from "./team-display";
import { attachHighlightUrls } from "./match-highlights";
import type {
  FifaDashboardView,
  GroupStandingView,
  LiveMatchView,
  ScheduleMatchView,
  ScorerView,
  StatCardView,
} from "./types";

function venueFromRow(row: Record<string, unknown>): string {
  const stadium = (row.Stadium as Record<string, unknown> | undefined) ?? {};
  const nameItems = stadium.Name as
    | { Locale?: string; Description?: string }[]
    | undefined;
  const cityItems = stadium.CityName as
    | { Locale?: string; Description?: string }[]
    | undefined;

  const name =
    nameItems?.find((item) => item.Description)?.Description?.toString() ?? "";
  const city =
    cityItems?.find((item) => item.Description)?.Description?.toString() ?? "";

  if (name && city) return `${name}, ${city}`;
  return name || city || "—";
}

function matchStageLabel(match: FifaMatch): string {
  if (match.group) return match.group;
  if (match.stage) return match.stage;
  return match.competition || "מונדיאל 2026";
}

function liveMinute(match: FifaMatch): string {
  if (match.status === "SCHEDULED") {
    return match.utcDate.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    });
  }
  if (match.status === "FINISHED") return "סיום";
  return latestMatchMinuteLabel(match);
}

function matchToLiveView(
  match: FifaMatch,
  venue = "—",
): LiveMatchView {
  const status =
    match.status === "IN_PLAY" || match.status === "PAUSE"
      ? "live"
      : match.status === "FINISHED"
        ? "finished"
        : "upcoming";

  return {
    id: match.id,
    home: match.homeTeam,
    homeFlag: match.homeFlag,
    homeCode: match.homeTeamCode,
    away: match.awayTeam,
    awayFlag: match.awayFlag,
    awayCode: match.awayTeamCode,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    minute: liveMinute(match),
    status,
    venue,
    league: matchStageLabel(match),
    kickoffAt: match.utcDate.toISOString(),
    highlightUrl: null,
    fifaCentreUrl: "",
    idCompetition: match.idCompetition,
    idSeason: match.idSeason,
    idStage: match.idStage,
  };
}

export async function fetchLiveMatches(fresh = false): Promise<LiveMatchView[]> {
  const rows = await getCalendarRowsById(-1, 3, fresh);
  const live = await getLiveMatchesNow(fresh);
  const upcoming = await getNextScheduledKickoffMatches(fresh);

  const seen = new Set<string>();
  const views: LiveMatchView[] = [];

  for (const match of live) {
    seen.add(match.id);
    views.push(matchToLiveView(match, venueFromRow(rows.get(match.id) ?? {})));
  }

  for (const match of upcoming) {
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    views.push(matchToLiveView(match, venueFromRow(rows.get(match.id) ?? {})));
    if (views.length >= 8) break;
  }

  if (views.length < 4) {
    const recentRows = [...rows.values()]
      .filter((row) => Number(row.MatchStatus ?? -1) === 0)
      .sort(
        (a, b) =>
          parseDatetime(b.Date as string | undefined).getTime() -
          parseDatetime(a.Date as string | undefined).getTime(),
      )
      .slice(0, 4);

    for (const row of recentRows) {
      const match = calendarRowToMatch(row);
      if (seen.has(match.id)) continue;
      seen.add(match.id);
      views.push(matchToLiveView(match, venueFromRow(row)));
      if (views.length >= 8) break;
    }
  }

  return attachHighlightUrls(views.slice(0, 8));
}

function isRowFinished(row: Record<string, unknown>): boolean {
  const home = row.HomeTeamScore;
  const away = row.AwayTeamScore;
  if (home === null || home === undefined || away === null || away === undefined) {
    return false;
  }

  const kickoff = parseDatetime(row.Date as string | undefined);
  if (kickoff > new Date()) return false;

  const status = Number(row.MatchStatus ?? -1);
  if (status === 0) return true;

  return kickoff.getTime() < Date.now() - 105 * 60 * 1000;
}

function teamLabelFromSide(side: Record<string, unknown>) {
  return calendarTeamLabels(side);
}

export async function fetchGroupStandings(fresh = false): Promise<GroupStandingView[]> {
  const tables = new Map<
    string,
    Map<
      string,
      { name: string; code: string; flag: string; played: number; gd: number; pts: number }
    >
  >();

  const rows = await getCalendarRowsById(-14, 7, fresh);
  for (const row of rows.values()) {
      const groupItems = row.GroupName as
        | { Description?: string }[]
        | undefined;
      const group = groupItems?.find((item) => item.Description)?.Description;
      if (!group || !isRowFinished(row)) continue;

      const homeSide = (row.Home as Record<string, unknown> | undefined) ?? {};
      const awaySide = (row.Away as Record<string, unknown> | undefined) ?? {};
      const home = teamLabelFromSide(homeSide);
      const away = teamLabelFromSide(awaySide);
      const homeScore = Number(row.HomeTeamScore);
      const awayScore = Number(row.AwayTeamScore);

      if (!tables.has(group)) tables.set(group, new Map());
      const groupTable = tables.get(group)!;

      for (const team of [home, away]) {
        const key = team.code || team.name;
        if (!groupTable.has(key)) {
          groupTable.set(key, {
            name: team.name,
            code: team.code,
            flag: team.flag,
            played: 0,
            gd: 0,
            pts: 0,
          });
        }
      }

      const homeEntry = groupTable.get(home.code || home.name)!;
      const awayEntry = groupTable.get(away.code || away.name)!;
      homeEntry.played += 1;
      awayEntry.played += 1;
      homeEntry.gd += homeScore - awayScore;
      awayEntry.gd += awayScore - homeScore;

      if (homeScore > awayScore) {
        homeEntry.pts += 3;
      } else if (awayScore > homeScore) {
        awayEntry.pts += 3;
      } else {
        homeEntry.pts += 1;
        awayEntry.pts += 1;
      }
  }

  const groups: GroupStandingView[] = [];
  for (const [group, teams] of [...tables.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const sortedTeams = [...teams.values()].sort(
      (a, b) => b.pts - a.pts || b.gd - a.gd || a.name.localeCompare(b.name),
    );
    groups.push({
      group: group.replace("Group ", "").trim() || group,
      teams: sortedTeams,
    });
  }

  return groups.slice(0, 6);
}

function playerPhoto(name: string): string {
  const safe = name.trim().replace(/\s+/g, "+");
  return `https://ui-avatars.com/api/?name=${safe}&background=d4af37&color=111&size=200&bold=true`;
}

export async function fetchTopScorers(limit = 10, fresh = false): Promise<ScorerView[]> {
  const now = new Date();
  const candidateIds: string[] = [];
  const seen = new Set<string>();

  const rows = await getCalendarRowsById(-14, 2, fresh);
  for (const row of rows.values()) {
    const matchId = String(row.IdMatch);
    if (seen.has(matchId)) continue;
    const kickoff = parseDatetime(row.Date as string | undefined);
    if (kickoff > now && row.HomeTeamScore == null) continue;
    seen.add(matchId);
    candidateIds.push(matchId);
  }

  const matches = await getMatchesByIds(candidateIds.slice(0, 30), fresh);
  const scorers = new Map<
    string,
    {
      name: string;
      team: string;
      teamCode: string;
      flag: string;
      goals: number;
      assists: number;
    }
  >();

  for (const match of matches) {
    for (const goal of match.goals) {
      if (isPlaceholderScorer(goal.scorer)) continue;
      const key = goal.scorer.trim().toUpperCase();
      const team = goal.teamName || match.homeTeam;
      const teamCode =
        goal.teamName === match.homeTeam
          ? match.homeTeamCode
          : match.awayTeamCode;
      const flag = countryFlag(teamCode);

      const current = scorers.get(key) ?? {
        name: goal.scorer.trim(),
        team,
        teamCode,
        flag,
        goals: 0,
        assists: 0,
      };
      if (team && !current.team) current.team = team;
      if (teamCode && !current.teamCode) current.teamCode = teamCode;
      if (flag && !current.flag) current.flag = flag;
      current.goals += 1;
      scorers.set(key, current);
    }
  }

  const ranked = [...scorers.values()].sort(
    (a, b) => b.goals - a.goals || a.name.localeCompare(b.name),
  );

  return ranked.slice(0, limit).map((scorer, index) => ({
    rank: index + 1,
    name: scorer.name,
    team: scorer.team,
    teamCode: scorer.teamCode,
    flag: scorer.flag,
    goals: scorer.goals,
    assists: scorer.assists,
    photo: playerPhoto(scorer.name),
  }));
}

export async function fetchStatCards(fresh = false): Promise<StatCardView[]> {
  let totalGoals = 0;
  let finishedCount = 0;
  const teams = new Set<string>();

  const rows = await getCalendarRowsById(-14, 7, fresh);
  for (const row of rows.values()) {
      const homeSide = (row.Home as Record<string, unknown> | undefined) ?? {};
      const awaySide = (row.Away as Record<string, unknown> | undefined) ?? {};
      const home = teamLabelFromSide(homeSide);
      const away = teamLabelFromSide(awaySide);
      if (home.code) teams.add(home.code);
      if (away.code) teams.add(away.code);

      if (isRowFinished(row)) {
        finishedCount += 1;
        totalGoals += Number(row.HomeTeamScore) + Number(row.AwayTeamScore);
      }
  }

  const liveCount = (await getLiveMatchesNow(fresh)).length;

  return [
    {
      label: "שערים",
      value: String(totalGoals),
      change: `${liveCount} משחקים חיים`,
      icon: "⚽",
    },
    {
      label: "משחקים",
      value: String(finishedCount),
      change: "הושלמו",
      icon: "🏟️",
    },
    {
      label: "חיים",
      value: String(liveCount),
      change: "עכשיו",
      icon: "👥",
    },
    {
      label: "נבחרות",
      value: String(teams.size || 48),
      change: "בטורניר",
      icon: "🌍",
    },
  ];
}

export async function fetchTournament() {
  return {
    totalTeams: 48,
    totalMatches: 104,
    totalCities: 16,
    images: IMAGES,
  };
}

export async function fetchFinishedMatches(limit = 6, fresh = false): Promise<FifaMatch[]> {
  const finished: FifaMatch[] = [];

  for (let dayOffset = -7; dayOffset < 1; dayOffset++) {
    const rows = await getCalendarMatches(dayOffset, fresh);
    for (const row of rows) {
      if (!isRowFinished(row)) continue;
      try {
        finished.push(await getMatchById(String(row.IdMatch), fresh));
      } catch {
        // Skip matches that fail to load.
      }
    }
  }

  finished.sort((a, b) => b.utcDate.getTime() - a.utcDate.getTime());
  return finished.slice(0, limit);
}

export async function fetchFifaDashboard(fresh = true): Promise<FifaDashboardView> {
  const [matches, standings, scorers] = await Promise.all([
    fetchLiveMatches(fresh),
    fetchGroupStandings(fresh),
    fetchTopScorers(10, fresh),
  ]);

  const nextMatch =
    matches.find((match) => match.status === "upcoming") ??
    matches.find((match) => match.status === "live") ??
    null;

  return {
    matches,
    standings,
    scorers,
    nextMatch,
    fetchedAt: new Date().toISOString(),
  };
}

function dayOffsetFromIsoDate(isoDate: string): number {
  const target = new Date(`${isoDate}T12:00:00Z`);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const targetUtc = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );
  return Math.round((targetUtc - todayUtc) / 86_400_000);
}

function scheduleStatus(
  match: FifaMatch,
): ScheduleMatchView["status"] {
  if (match.status === "IN_PLAY" || match.status === "PAUSE") return "live";
  if (match.status === "FINISHED") return "finished";
  return "upcoming";
}

function rowToScheduleView(row: Record<string, unknown>): ScheduleMatchView {
  const match = calendarRowToMatch(row);
  const kickoff = match.utcDate;

  return {
    id: match.id,
    home: match.homeTeam,
    homeFlag: match.homeFlag,
    homeCode: match.homeTeamCode,
    away: match.awayTeam,
    awayFlag: match.awayFlag,
    awayCode: match.awayTeamCode,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    kickoffAt: kickoff.toISOString(),
    dateLabel: kickoff.toLocaleDateString("he-IL", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Jerusalem",
    }),
    timeLabel: kickoff.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    }),
    status: scheduleStatus(match),
    stage: matchStageLabel(match),
    venue: venueFromRow(row),
    matchNumber:
      row.MatchNumber !== null && row.MatchNumber !== undefined
        ? Number(row.MatchNumber)
        : null,
  };
}

export async function fetchFullSchedule(fresh = false): Promise<ScheduleMatchView[]> {
  const fromOffset = dayOffsetFromIsoDate(TOURNAMENT_META.startDate);
  const toOffset = dayOffsetFromIsoDate(TOURNAMENT_META.endDate);
  const rows = await getCalendarRowsById(fromOffset, toOffset, fresh);

  const matches = [...rows.values()]
    .map((row) => rowToScheduleView(row))
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

  return matches;
}
