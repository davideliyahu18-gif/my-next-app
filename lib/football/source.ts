/**
 * Multi-league football data source (FIFA API).
 * Swap FOOTBALL_FIFA_BASE_URL / FOOTBALL_FIFA_COMPETITIONS when you bring a new FIFA source.
 */

import { countryFlag, hebrewTeamName } from "@/lib/team-display";
import {
  getEnabledFootballCompetitions,
  type FootballCompetition,
} from "./competitions";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const PERIOD_IN_PLAY = new Set([3, 5, 7, 9]);
const PERIOD_FINISHED = new Set([10, 11]);

export type FootballMatchStatus =
  | "SCHEDULED"
  | "IN_PLAY"
  | "PAUSE"
  | "FINISHED";

export interface FootballMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamCode: string;
  awayTeamCode: string;
  homeFlag: string;
  awayFlag: string;
  utcDate: Date;
  status: FootballMatchStatus;
  competitionId: string;
  competition: string;
  homeScore: number | null;
  awayScore: number | null;
  matchTime: string | null;
  period: number | null;
  stage: string | null;
}

type LocalizedItem = { Locale?: string; Description?: string };
type CalendarRow = Record<string, unknown>;

function baseUrl(): string {
  return (
    process.env.FOOTBALL_FIFA_BASE_URL ||
    process.env.FIFA_API_BASE_URL ||
    "https://api.fifa.com/api/v3"
  ).replace(/\/$/, "");
}

function language(): string {
  return process.env.FIFA_API_LANGUAGE ?? "en";
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

function parseDatetime(value: string | null | undefined): Date {
  if (!value) return new Date();
  return new Date(value.replace("Z", "+00:00"));
}

async function fifaGet(
  path: string,
  params?: Record<string, string | number>,
  fresh = false,
): Promise<Record<string, unknown>> {
  const url = new URL(`${baseUrl()}/${path.replace(/^\//, "")}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== "" && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    ...(fresh
      ? { cache: "no-store" as const }
      : { next: { revalidate: 30 } }),
  });

  if (!response.ok) {
    throw new Error(
      `FIFA football source ${response.status} for ${path}: ${await response.text()}`,
    );
  }

  return response.json() as Promise<Record<string, unknown>>;
}

function mapStatus(period: number | null): FootballMatchStatus {
  if (period === 4) return "PAUSE";
  if (period !== null && PERIOD_FINISHED.has(period)) return "FINISHED";
  if (period !== null && PERIOD_IN_PLAY.has(period)) return "IN_PLAY";
  return "SCHEDULED";
}

function teamLabels(side: Record<string, unknown>) {
  const code = String(side.Abbreviation ?? side.IdCountry ?? "");
  const english = localizedName(side.TeamName as LocalizedItem[] | undefined);
  const name =
    process.env.ENABLE_HEBREW_TEAM_NAMES === "false"
      ? english
      : hebrewTeamName(code, english);
  const flag =
    process.env.ENABLE_TEAM_FLAGS === "false" ? "" : countryFlag(code);
  return { name, flag, code };
}

function competitionLabel(
  row: CalendarRow,
  competition: FootballCompetition,
): string {
  const fromRow = localizedName(
    row.CompetitionName as LocalizedItem[] | undefined,
  );
  return fromRow || competition.nameHe || competition.nameEn || competition.id;
}

function scoreFromSide(side: Record<string, unknown>): number | null {
  const score = side.Score;
  if (typeof score === "number") return score;
  if (typeof score === "string" && score.trim() !== "") {
    const n = Number(score);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function calendarRowToMatch(
  row: CalendarRow,
  competition: FootballCompetition,
): FootballMatch {
  const home = (row.Home as Record<string, unknown> | undefined) ?? {};
  const away = (row.Away as Record<string, unknown> | undefined) ?? {};
  const homeLabels = teamLabels(home);
  const awayLabels = teamLabels(away);
  const period =
    row.Period == null || row.Period === "" ? null : Number(row.Period);
  const matchTimeRaw = row.MatchTime ?? row.MatchTimeShort;
  const matchTime =
    matchTimeRaw == null || String(matchTimeRaw).trim() === ""
      ? null
      : String(matchTimeRaw);

  return {
    id: String(row.IdMatch),
    homeTeam: homeLabels.name,
    awayTeam: awayLabels.name,
    homeTeamCode: homeLabels.code,
    awayTeamCode: awayLabels.code,
    homeFlag: homeLabels.flag,
    awayFlag: awayLabels.flag,
    utcDate: parseDatetime(row.Date as string | undefined),
    status: mapStatus(Number.isFinite(period) ? period : null),
    competitionId: competition.id,
    competition: competitionLabel(row, competition),
    homeScore: scoreFromSide(home),
    awayScore: scoreFromSide(away),
    matchTime,
    period: Number.isFinite(period) ? period : null,
    stage:
      localizedName(row.StageName as LocalizedItem[] | undefined) ||
      localizedName(row.GroupName as LocalizedItem[] | undefined) ||
      null,
  };
}

async function getCalendarForCompetition(
  competition: FootballCompetition,
  dayOffset: number,
  fresh: boolean,
): Promise<FootballMatch[]> {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + dayOffset);
  const start = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1000);

  const params: Record<string, string | number> = {
    from: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
    to: end.toISOString().replace(/\.\d{3}Z$/, "Z"),
    language: language(),
    count: Number(process.env.FOOTBALL_MATCH_COUNT ?? "200"),
    IdCompetition: competition.id,
  };
  if (competition.seasonId) params.IdSeason = competition.seasonId;

  try {
    const data = await fifaGet("calendar/matches", params, fresh);
    const rows = (data.Results as CalendarRow[] | undefined) ?? [];
    return rows.map((row) => calendarRowToMatch(row, competition));
  } catch {
    // Competition/season may be inactive — skip quietly.
    return [];
  }
}

async function enrichLiveMatch(
  match: FootballMatch,
  fresh: boolean,
): Promise<FootballMatch> {
  try {
    const live = await fifaGet(
      `live/football/${match.id}`,
      { language: language() },
      fresh,
    );
    const home = (live.HomeTeam as Record<string, unknown> | undefined) ?? {};
    const away = (live.AwayTeam as Record<string, unknown> | undefined) ?? {};
    const period =
      live.Period == null || live.Period === "" ? null : Number(live.Period);
    const matchTimeRaw = live.MatchTime ?? live.MatchTimeShort;

    return {
      ...match,
      homeScore:
        typeof live.HomeTeamScore === "number"
          ? live.HomeTeamScore
          : scoreFromSide(home) ?? match.homeScore,
      awayScore:
        typeof live.AwayTeamScore === "number"
          ? live.AwayTeamScore
          : scoreFromSide(away) ?? match.awayScore,
      period: Number.isFinite(period) ? period : match.period,
      status: mapStatus(
        Number.isFinite(period) ? (period as number) : match.period,
      ),
      matchTime:
        matchTimeRaw == null || String(matchTimeRaw).trim() === ""
          ? match.matchTime
          : String(matchTimeRaw),
    };
  } catch {
    return match;
  }
}

function dedupeMatches(matches: FootballMatch[]): FootballMatch[] {
  const byId = new Map<string, FootballMatch>();
  for (const match of matches) {
    byId.set(match.id, match);
  }
  return [...byId.values()].sort(
    (a, b) => a.utcDate.getTime() - b.utcDate.getTime(),
  );
}

/** Calendar matches across all enabled FIFA competitions. */
export async function fetchFootballCalendar(
  dayOffsets: number[],
  fresh = false,
): Promise<FootballMatch[]> {
  const competitions = getEnabledFootballCompetitions();
  const batches = await Promise.all(
    competitions.flatMap((competition) =>
      dayOffsets.map((offset) =>
        getCalendarForCompetition(competition, offset, fresh),
      ),
    ),
  );
  return dedupeMatches(batches.flat());
}

/** Live / pause matches right now (all leagues). */
export async function fetchLiveFootballMatches(
  fresh = false,
): Promise<FootballMatch[]> {
  const now = Date.now();
  const calendar = await fetchFootballCalendar([0, -1], fresh);
  const candidates = calendar.filter((match) => {
    const kickoff = match.utcDate.getTime();
    return kickoff <= now + 15 * 60 * 1000 && kickoff >= now - 5 * 60 * 60 * 1000;
  });

  const enriched = await Promise.all(
    candidates.map((match) => enrichLiveMatch(match, fresh)),
  );

  return enriched
    .filter((match) => match.status === "IN_PLAY" || match.status === "PAUSE")
    .sort((a, b) => a.utcDate.getTime() - b.utcDate.getTime());
}

/** Upcoming + recent board for commands / reminders. */
export async function fetchFootballBoard(fresh = false): Promise<{
  live: FootballMatch[];
  upcoming: FootballMatch[];
  finished: FootballMatch[];
  competitions: FootballCompetition[];
}> {
  const now = Date.now();
  const [calendar, live] = await Promise.all([
    fetchFootballCalendar([-1, 0, 1, 2], fresh),
    fetchLiveFootballMatches(fresh),
  ]);

  const liveIds = new Set(live.map((match) => match.id));
  const upcoming = calendar
    .filter(
      (match) =>
        !liveIds.has(match.id) &&
        match.status === "SCHEDULED" &&
        match.utcDate.getTime() >= now - 5 * 60 * 1000,
    )
    .slice(0, 40);

  const finished = calendar
    .filter(
      (match) =>
        !liveIds.has(match.id) &&
        (match.status === "FINISHED" ||
          (match.homeScore != null &&
            match.awayScore != null &&
            match.utcDate.getTime() < now)),
    )
    .slice(-12)
    .reverse();

  return {
    live,
    upcoming,
    finished,
    competitions: getEnabledFootballCompetitions(),
  };
}

/** Matches useful for alert diffs (live + about to start + just finished). */
export async function fetchFootballAlertCandidates(
  fresh = false,
): Promise<FootballMatch[]> {
  const now = Date.now();
  const calendar = await fetchFootballCalendar([-1, 0, 1], fresh);
  const windowed = calendar.filter((match) => {
    const kickoff = match.utcDate.getTime();
    return kickoff >= now - 4 * 60 * 60 * 1000 && kickoff <= now + 45 * 60 * 1000;
  });

  const enriched = await Promise.all(
    windowed.map((match) => enrichLiveMatch(match, fresh)),
  );
  return dedupeMatches(enriched);
}
