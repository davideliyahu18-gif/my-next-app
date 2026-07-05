import { FIFA_CONFIG } from "./constants";
import { countryFlag, hebrewTeamName } from "./team-display";

const FIFA_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const GOAL_EVENT_TYPES = new Set([0, 34, 39, 41]);
const PERIOD_IN_PLAY = new Set([3, 5, 7, 9]);
const PERIOD_FINISHED = new Set([10, 11]);
const UNKNOWN_SCORER = "Unknown scorer";

const SCORER_DESCRIPTION_SPLIT =
  /\s+scores?(?:!!|!| an own goal\.?| from the penalty(?: spot)?!!?)/i;
const PLACEHOLDER_SCORER =
  /^(?:assisted by\b|unknown\b|.+?\sscore!?)$/i;

export class FifaApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FifaApiError";
  }
}

export interface FifaGoal {
  eventId: string;
  minute: string;
  scorer: string;
  teamName: string;
  teamId: string;
}

export interface FifaMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamCode: string;
  awayTeamCode: string;
  homeFlag: string;
  awayFlag: string;
  utcDate: Date;
  status: "SCHEDULED" | "IN_PLAY" | "PAUSE" | "FINISHED";
  competition: string;
  homeScore: number | null;
  awayScore: number | null;
  goals: FifaGoal[];
  stage: string | null;
  group: string | null;
  period: number | null;
  matchTime: string | null;
  idCompetition: string;
  idSeason: string;
  idStage: string;
}

type LocalizedItem = { Locale?: string; Description?: string };
type CalendarRow = Record<string, unknown>;

function matchIdsFromRow(row: CalendarRow) {
  return {
    idCompetition: String(row.IdCompetition ?? FIFA_CONFIG.idCompetition),
    idSeason: String(row.IdSeason ?? FIFA_CONFIG.idSeason),
    idStage: String(row.IdStage ?? FIFA_CONFIG.idStage),
  };
}

function localizedName(
  items: LocalizedItem[] | null | undefined,
  preferredLocales: string[] = ["he", "en"],
): string {
  if (!items?.length) return "";

  const byLocale: Record<string, string> = {};
  for (const item of items) {
    const locale = String(item.Locale ?? "").toLowerCase();
    const description = String(item.Description ?? "");
    if (locale) byLocale[locale] = description;
  }

  for (const preferred of preferredLocales) {
    for (const [locale, description] of Object.entries(byLocale)) {
      if (locale.includes(preferred) && description) return description;
    }
  }

  for (const item of items) {
    if (item.Description) return String(item.Description);
  }
  return "";
}

export function parseDatetime(value: string | null | undefined): Date {
  if (!value) return new Date();
  return new Date(value.replace("Z", "+00:00"));
}

async function fifaGet(
  path: string,
  params?: Record<string, string | number>,
  options?: { fresh?: boolean },
): Promise<Record<string, unknown>> {
  const url = new URL(
    `${FIFA_CONFIG.baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`,
  );
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== "" && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": FIFA_USER_AGENT,
      Accept: "application/json",
    },
    ...(options?.fresh
      ? { cache: "no-store" as const }
      : { next: { revalidate: FIFA_CONFIG.revalidateSeconds } }),
  });

  if (!response.ok) {
    throw new FifaApiError(
      `FIFA API error ${response.status} for ${path}: ${await response.text()}`,
    );
  }

  return response.json() as Promise<Record<string, unknown>>;
}

function calendarParams(day: Date): Record<string, string | number> {
  const start = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1000);

  const params: Record<string, string | number> = {
    from: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
    to: end.toISOString().replace(/\.\d{3}Z$/, "Z"),
    language: FIFA_CONFIG.language,
    count: FIFA_CONFIG.matchCount,
  };

  if (FIFA_CONFIG.idCompetition) {
    params.IdCompetition = FIFA_CONFIG.idCompetition;
  }
  if (FIFA_CONFIG.idSeason) {
    params.IdSeason = FIFA_CONFIG.idSeason;
  }

  return params;
}

export async function getCalendarMatches(
  dayOffset = 0,
  fresh = false,
): Promise<CalendarRow[]> {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + dayOffset);
  const data = await fifaGet("calendar/matches", calendarParams(day), { fresh });
  return (data.Results as CalendarRow[] | undefined) ?? [];
}

export async function getCalendarRowsById(
  fromOffset: number,
  toOffset: number,
  fresh = false,
): Promise<Map<string, CalendarRow>> {
  const offsets = Array.from(
    { length: toOffset - fromOffset + 1 },
    (_, index) => fromOffset + index,
  );
  const batches = await Promise.all(
    offsets.map((offset) => getCalendarMatches(offset, fresh)),
  );

  const rows = new Map<string, CalendarRow>();
  for (const dayRows of batches) {
    for (const row of dayRows) {
      rows.set(String(row.IdMatch), row);
    }
  }
  return rows;
}

async function getLiveMatch(
  matchId: string,
  fresh = false,
): Promise<Record<string, unknown>> {
  return fifaGet(
    `live/football/${matchId}`,
    { language: FIFA_CONFIG.language },
    { fresh },
  );
}

async function getTimeline(
  matchId: string,
  fresh = false,
): Promise<Record<string, unknown>> {
  return fifaGet(
    `timelines/${matchId}`,
    { language: FIFA_CONFIG.language },
    { fresh },
  );
}

function parseScorer(description: string): string {
  if (!description) return "";
  const parts = description.split(SCORER_DESCRIPTION_SPLIT);
  const cleaned = parts[0]?.trim() ?? "";
  return cleaned.replace(/\s*\([^)]+\)\s*$/, "").trim();
}

export function isPlaceholderScorer(scorer: string): boolean {
  const cleaned = scorer.trim();
  if (!cleaned || cleaned === UNKNOWN_SCORER) return true;
  if (PLACEHOLDER_SCORER.test(cleaned)) return true;
  if (cleaned.toLowerCase().startsWith("assisted by")) return true;
  return false;
}

async function playerName(playerId: string | number | null | undefined): Promise<string> {
  if (!playerId) return "";
  try {
    const data = await fifaGet(`players/${playerId}`);
    return localizedName(
      (data.Name as LocalizedItem[] | undefined) ??
        (data.Alias as LocalizedItem[] | undefined),
    );
  } catch {
    return "";
  }
}

async function scorerFromTimelineEvent(
  event: Record<string, unknown>,
): Promise<string> {
  const description = localizedName(
    event.EventDescription as LocalizedItem[] | undefined,
  );
  const player = await playerName(event.IdPlayer as string | number | undefined);
  const scorer = parseScorer(description);

  if (scorer && !isPlaceholderScorer(scorer)) return scorer;
  if (player) return player;
  if (scorer) return scorer;
  return UNKNOWN_SCORER;
}

function mapStatus(period: number | null): FifaMatch["status"] {
  if (period === 4) return "PAUSE";
  if (period !== null && PERIOD_FINISHED.has(period)) return "FINISHED";
  if (period !== null && PERIOD_IN_PLAY.has(period)) return "IN_PLAY";
  return "SCHEDULED";
}

function teamSide(
  teamId: string,
  homeTeamId: string,
  awayTeamId: string,
): "home" | "away" | "" {
  if (teamId === homeTeamId) return "home";
  if (teamId === awayTeamId) return "away";
  return "";
}

async function parseGoalsFromTimeline(
  timeline: Record<string, unknown>,
  homeTeamId: string,
  awayTeamId: string,
  homeTeam: string,
  awayTeam: string,
): Promise<FifaGoal[]> {
  const events = (timeline.Event as Record<string, unknown>[] | undefined) ?? [];
  const goals: FifaGoal[] = [];

  for (const event of events) {
    if (!GOAL_EVENT_TYPES.has(Number(event.Type))) continue;
    const teamId = String(event.IdTeam ?? "");
    const side = teamSide(teamId, homeTeamId, awayTeamId);
    const teamName =
      side === "home" ? homeTeam : side === "away" ? awayTeam : "";

    goals.push({
      eventId: String(event.EventId ?? ""),
      minute: String(event.MatchMinute ?? "?"),
      scorer: await scorerFromTimelineEvent(event),
      teamName,
      teamId,
    });
  }

  return goals;
}

export function calendarTeamLabels(side: Record<string, unknown>): {
  name: string;
  flag: string;
  code: string;
} {
  const code = String(side.Abbreviation ?? side.IdCountry ?? "");
  const english = localizedName(side.TeamName as LocalizedItem[] | undefined);
  const name = FIFA_CONFIG.enableHebrewTeamNames
    ? hebrewTeamName(code, english)
    : english;
  const flag = FIFA_CONFIG.enableTeamFlags ? countryFlag(code) : "";
  return { name, flag, code };
}

function formatMatchTimeLabel(
  matchTime: string | null | undefined,
  period: number | null,
  status: FifaMatch["status"],
): string | null {
  if (status === "PAUSE" || period === 4) return "HT";
  if (!matchTime) return null;
  const cleaned = String(matchTime).trim();
  if (!cleaned || cleaned === "—") return null;
  if (cleaned === "HT") return "HT";
  return cleaned.endsWith("'") ? cleaned : `${cleaned}'`;
}

async function fetchLiveAndTimeline(
  matchId: string,
  fresh = false,
): Promise<[Record<string, unknown>, Record<string, unknown>]> {
  const [liveResult, timelineResult] = await Promise.allSettled([
    getLiveMatch(matchId, fresh),
    getTimeline(matchId, fresh),
  ]);

  return [
    liveResult.status === "fulfilled" ? liveResult.value : {},
    timelineResult.status === "fulfilled"
      ? timelineResult.value
      : { Event: [] },
  ];
}

async function buildMatch(
  calendarRow: CalendarRow,
  prefetched?: {
    liveData?: Record<string, unknown>;
    timelineData?: Record<string, unknown>;
  },
  fresh = false,
): Promise<FifaMatch> {
  const matchId = String(calendarRow.IdMatch);
  const home = (calendarRow.Home as Record<string, unknown> | undefined) ?? {};
  const away = (calendarRow.Away as Record<string, unknown> | undefined) ?? {};
  const homeTeamId = String(home.IdTeam ?? "");
  const awayTeamId = String(away.IdTeam ?? "");
  const homeLabels = calendarTeamLabels(home);
  const awayLabels = calendarTeamLabels(away);

  let liveData = prefetched?.liveData;
  let timelineData = prefetched?.timelineData;
  if (!liveData || !timelineData) {
    const fetched = await fetchLiveAndTimeline(matchId, fresh);
    liveData = liveData ?? fetched[0];
    timelineData = timelineData ?? fetched[1];
  }

  const liveHome = (liveData.HomeTeam as Record<string, unknown> | undefined) ?? {};
  const liveAway = (liveData.AwayTeam as Record<string, unknown> | undefined) ?? {};
  let period =
    liveData.Period !== undefined && liveData.Period !== null
      ? Number(liveData.Period)
      : null;

  const rawHomeScore = liveHome.Score ?? calendarRow.HomeTeamScore;
  const rawAwayScore = liveAway.Score ?? calendarRow.AwayTeamScore;
  const homeScore: number | null =
    rawHomeScore !== null && rawHomeScore !== undefined
      ? Number(rawHomeScore)
      : null;
  const awayScore: number | null =
    rawAwayScore !== null && rawAwayScore !== undefined
      ? Number(rawAwayScore)
      : null;

  let status = mapStatus(period);
  if (status === "SCHEDULED") {
    const events = (timelineData.Event as Record<string, unknown>[] | undefined) ?? [];
    for (const event of events) {
      if (event.Type === 26) {
        status = "FINISHED";
        break;
      }
      if (event.Type === 7) {
        status = "IN_PLAY";
      }
    }
  }

  const goals = await parseGoalsFromTimeline(
    timelineData,
    homeTeamId,
    awayTeamId,
    homeLabels.name,
    awayLabels.name,
  );

  const matchTime =
    formatMatchTimeLabel(
      (liveData.MatchTime as string | undefined) ??
        (calendarRow.MatchTime as string | undefined),
      period,
      status,
    ) ?? null;

  return {
    id: matchId,
    homeTeam: homeLabels.name,
    awayTeam: awayLabels.name,
    homeTeamCode: homeLabels.code,
    awayTeamCode: awayLabels.code,
    homeFlag: homeLabels.flag,
    awayFlag: awayLabels.flag,
    utcDate: parseDatetime(calendarRow.Date as string | undefined),
    status,
    competition: localizedName(
      calendarRow.CompetitionName as LocalizedItem[] | undefined,
    ),
    homeScore,
    awayScore,
    goals,
    stage:
      localizedName(calendarRow.StageName as LocalizedItem[] | undefined) ||
      null,
    group:
      localizedName(calendarRow.GroupName as LocalizedItem[] | undefined) ||
      null,
    period,
    matchTime,
    ...matchIdsFromRow(calendarRow),
  };
}

function buildCalendarMatch(calendarRow: CalendarRow): FifaMatch {
  return calendarRowToMatch(calendarRow);
}

export function calendarRowToMatch(calendarRow: CalendarRow): FifaMatch {
  const home = (calendarRow.Home as Record<string, unknown> | undefined) ?? {};
  const away = (calendarRow.Away as Record<string, unknown> | undefined) ?? {};
  const homeLabels = calendarTeamLabels(home);
  const awayLabels = calendarTeamLabels(away);
  const utcDate = parseDatetime(calendarRow.Date as string | undefined);
  const now = new Date();
  const matchStatus = Number(calendarRow.MatchStatus ?? -1);
  const rawHome = calendarRow.HomeTeamScore ?? home.Score;
  const rawAway = calendarRow.AwayTeamScore ?? away.Score;
  const homeScore =
    rawHome !== null && rawHome !== undefined ? Number(rawHome) : null;
  const awayScore =
    rawAway !== null && rawAway !== undefined ? Number(rawAway) : null;

  let status: FifaMatch["status"] = "SCHEDULED";
  if (matchStatus === 0) {
    status = "FINISHED";
  } else if (utcDate <= now && (calendarRow.MatchTime || homeScore !== null)) {
    status = "IN_PLAY";
  } else if (utcDate > now) {
    status = "SCHEDULED";
  }

  const matchTime = formatMatchTimeLabel(
    calendarRow.MatchTime as string | undefined,
    null,
    status,
  );

  return {
    id: String(calendarRow.IdMatch),
    homeTeam: homeLabels.name,
    awayTeam: awayLabels.name,
    homeTeamCode: homeLabels.code,
    awayTeamCode: awayLabels.code,
    homeFlag: homeLabels.flag,
    awayFlag: awayLabels.flag,
    utcDate,
    status,
    competition: localizedName(
      calendarRow.CompetitionName as LocalizedItem[] | undefined,
    ),
    homeScore,
    awayScore,
    goals: [],
    stage:
      localizedName(calendarRow.StageName as LocalizedItem[] | undefined) ||
      null,
    group:
      localizedName(calendarRow.GroupName as LocalizedItem[] | undefined) ||
      null,
    period: null,
    matchTime,
    ...matchIdsFromRow(calendarRow),
  };
}

export async function getMatchById(
  matchId: string,
  fresh = false,
): Promise<FifaMatch> {
  const [liveData, timelineData] = await fetchLiveAndTimeline(matchId, fresh);
  const liveHome = (liveData.HomeTeam as Record<string, unknown> | undefined) ?? {};
  const liveAway = (liveData.AwayTeam as Record<string, unknown> | undefined) ?? {};

  const calendarRow: CalendarRow = {
    IdMatch: matchId,
    Date: liveData.Date,
    Home: {
      IdTeam: liveHome.IdTeam,
      TeamName: liveHome.TeamName,
      Abbreviation: liveHome.Abbreviation,
      IdCountry: liveHome.IdCountry,
    },
    Away: {
      IdTeam: liveAway.IdTeam,
      TeamName: liveAway.TeamName,
      Abbreviation: liveAway.Abbreviation,
      IdCountry: liveAway.IdCountry,
    },
    HomeTeamScore: liveHome.Score,
    AwayTeamScore: liveAway.Score,
    MatchTime: liveData.MatchTime,
    IdCompetition: liveData.IdCompetition,
    IdSeason: liveData.IdSeason,
    IdStage: liveData.IdStage,
    CompetitionName: liveData.CompetitionName,
    StageName: liveData.StageName,
    GroupName: liveData.GroupName,
  };

  return buildMatch(calendarRow, { liveData, timelineData }, fresh);
}

export async function getMatchesByIds(
  matchIds: string[],
  fresh = false,
): Promise<FifaMatch[]> {
  if (!matchIds.length) return [];

  const results = await Promise.allSettled(
    matchIds.map((matchId) => getMatchById(matchId, fresh)),
  );

  const matches: FifaMatch[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      matches.push(result.value);
    }
  }

  matches.sort((a, b) => a.utcDate.getTime() - b.utcDate.getTime());
  return matches;
}

export function latestMatchMinuteLabel(match: FifaMatch): string {
  if (match.status === "PAUSE") return "HT";
  if (match.matchTime) return match.matchTime;
  if (match.status === "FINISHED") return "סיום";
  let best = 0;
  for (const goal of match.goals) {
    const minuteMatch = goal.minute.match(/(\d+)/);
    if (minuteMatch) best = Math.max(best, Number(minuteMatch[1]));
  }
  return best > 0 ? `${best}'` : "—";
}

export async function getLiveMatchesNow(fresh = false): Promise<FifaMatch[]> {
  const liveStatuses = new Set<FifaMatch["status"]>(["IN_PLAY", "PAUSE"]);
  const now = new Date();
  const candidateIds: string[] = [];
  const seen = new Set<string>();

  for (const dayOffset of [0, -1]) {
    const rows = await getCalendarMatches(dayOffset, fresh);
    for (const row of rows) {
      const matchId = String(row.IdMatch);
      if (seen.has(matchId)) continue;
      seen.add(matchId);
      const kickoff = parseDatetime(row.Date as string | undefined);
      if (kickoff.getTime() > now.getTime() + 15 * 60 * 1000) continue;
      if (kickoff.getTime() < now.getTime() - 5 * 60 * 60 * 1000) continue;
      candidateIds.push(matchId);
    }
  }

  if (!candidateIds.length) return [];

  const matches = await getMatchesByIds(candidateIds, fresh);
  return matches
    .filter((match) => liveStatuses.has(match.status))
    .sort((a, b) => a.utcDate.getTime() - b.utcDate.getTime());
}

export async function getUpcomingCalendarRows(
  maxDays = 3,
  fresh = false,
): Promise<CalendarRow[]> {
  const now = new Date();
  const batches = await Promise.all(
    Array.from({ length: maxDays }, (_, index) => getCalendarMatches(index, fresh)),
  );

  const rows = batches
    .flat()
    .filter((row) => parseDatetime(row.Date as string | undefined) > now);

  rows.sort(
    (a, b) =>
      parseDatetime(a.Date as string | undefined).getTime() -
      parseDatetime(b.Date as string | undefined).getTime(),
  );
  return rows;
}

export async function getNextScheduledKickoffMatches(
  fresh = false,
): Promise<FifaMatch[]> {
  const now = new Date();
  const rows = await getUpcomingCalendarRows(7, fresh);
  const matches: FifaMatch[] = [];

  for (const row of rows) {
    const match = calendarRowToMatch(row);
    if (match.status !== "SCHEDULED") continue;
    if (match.utcDate <= now) continue;
    matches.push(match);
  }

  if (!matches.length) return [];

  matches.sort((a, b) => a.utcDate.getTime() - b.utcDate.getTime());
  const earliest = matches[0].utcDate.getTime();
  return matches.filter((match) => match.utcDate.getTime() === earliest);
}
