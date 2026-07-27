/**
 * Football domain source — ESPN domestic leagues + FIFA live client.
 */

import { countryFlag, hebrewTeamName } from "@/lib/team-display";
import {
  getEnabledFootballCompetitions,
  type FootballCompetition,
} from "./competitions";
import {
  FIFA_LIVE_DEFAULTS,
  getCalendarMatchesForDayOffset,
  getLiveFootballMatch,
  getMatchTimeline,
  type FifaJson,
} from "@/src/football/fifaLiveClient";
import {
  espnScoreboardEvents,
  getEspnScoreboard,
  type EspnJson,
} from "@/src/football/espnLeaguesClient";

const PERIOD_IN_PLAY = new Set([3, 5, 7, 9]);
const PERIOD_FINISHED = new Set([10, 11]);
const GOAL_EVENT_TYPES = new Set([0, 34, 39, 41]);
const OWN_GOAL_EVENT_TYPE = 34;

const SCORER_DESCRIPTION_SPLIT =
  /\s+(?:scores?(?:!!|!| an own goal\.?| from the penalty(?: spot)?!!?)|successfully converts the penalty!)/i;
const OWN_GOAL_DESCRIPTION = /\bown goal\b/i;
const PLACEHOLDER_SCORER =
  /^(?:assisted by\b|unknown\b|.+?\sscore!?)$/i;

export type FootballMatchStatus =
  | "SCHEDULED"
  | "IN_PLAY"
  | "PAUSE"
  | "FINISHED";

export interface FootballGoal {
  eventId: string;
  minute: string;
  scorer: string;
  teamName: string;
  teamId: string;
  ownGoal: boolean;
}

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
  goals: FootballGoal[];
  provider: "espn" | "fifa";
}

type LocalizedItem = { Locale?: string; Description?: string };

function localizedName(
  items: LocalizedItem[] | LocalizedItem | null | undefined,
  preferredLocales: string[] = ["he", "en"],
): string {
  const list = Array.isArray(items) ? items : items ? [items] : [];
  if (!list.length) return "";

  const byLocale: Record<string, string> = {};
  for (const item of list) {
    const locale = String(item.Locale ?? "").toLowerCase();
    const description = String(item.Description ?? "");
    if (locale) byLocale[locale] = description;
  }
  for (const preferred of preferredLocales) {
    for (const [locale, description] of Object.entries(byLocale)) {
      if (locale.includes(preferred) && description) return description;
    }
  }
  for (const item of list) {
    if (item.Description) return String(item.Description);
  }
  return "";
}

function parseDatetime(value: string | null | undefined): Date {
  if (!value) return new Date();
  return new Date(value.replace("Z", "+00:00"));
}

function mapFifaStatus(period: number | null): FootballMatchStatus {
  if (period === 4) return "PAUSE";
  if (period !== null && PERIOD_FINISHED.has(period)) return "FINISHED";
  if (period !== null && PERIOD_IN_PLAY.has(period)) return "IN_PLAY";
  return "SCHEDULED";
}

function mapEspnStatus(stateName: string): FootballMatchStatus {
  const key = stateName.toUpperCase();
  if (key.includes("HALFTIME") || key.includes("HALF_TIME")) return "PAUSE";
  if (key.includes("IN_PROGRESS") || key.includes("STATUS_IN_PROGRESS")) {
    return "IN_PLAY";
  }
  if (
    key.includes("FINAL") ||
    key.includes("FULL_TIME") ||
    key.includes("STATUS_FULL_TIME")
  ) {
    return "FINISHED";
  }
  return "SCHEDULED";
}

function teamLabelsFromCode(
  code: string,
  english: string,
  options?: { treatAsClub?: boolean },
) {
  if (options?.treatAsClub) {
    return { name: english, flag: "", code };
  }
  const name =
    process.env.ENABLE_HEBREW_TEAM_NAMES === "false"
      ? english
      : hebrewTeamName(code, english);
  const flag =
    process.env.ENABLE_TEAM_FLAGS === "false" ? "" : countryFlag(code);
  return { name, flag, code };
}

function fifaTeamLabels(side: FifaJson) {
  const code = String(side.Abbreviation ?? side.IdCountry ?? "");
  const english = localizedName(side.TeamName as LocalizedItem[] | undefined);
  const shortClub =
    typeof side.ShortClubName === "string" ? side.ShortClubName : "";
  return teamLabelsFromCode(code, english || shortClub);
}

function competitionLabelFifa(row: FifaJson, competition: FootballCompetition) {
  const fromRow = localizedName(
    row.CompetitionName as LocalizedItem[] | undefined,
  );
  return fromRow || competition.nameHe || competition.nameEn || competition.id;
}

function scoreFromSide(side: FifaJson): number | null {
  const score = side.Score;
  if (typeof score === "number") return score;
  if (typeof score === "string" && score.trim() !== "") {
    const n = Number(score);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseScorer(description: string): string {
  if (!description) return "";
  const parts = description.split(SCORER_DESCRIPTION_SPLIT);
  return (parts[0]?.trim() ?? "").replace(/\s*\([^)]+\)\s*$/, "").trim();
}

function isPlaceholderScorer(scorer: string): boolean {
  const cleaned = scorer.trim();
  if (!cleaned) return true;
  if (PLACEHOLDER_SCORER.test(cleaned)) return true;
  if (cleaned.toLowerCase().startsWith("assisted by")) return true;
  return false;
}

function parseGoalsFromTimeline(
  timeline: FifaJson,
  homeTeamId: string,
  awayTeamId: string,
  homeTeam: string,
  awayTeam: string,
): FootballGoal[] {
  const events = (timeline.Event as FifaJson[] | undefined) ?? [];
  const goals: FootballGoal[] = [];

  for (const event of events) {
    const eventType = Number(event.Type);
    if (!GOAL_EVENT_TYPES.has(eventType)) continue;

    const teamId = String(event.IdTeam ?? "");
    const teamName =
      teamId === homeTeamId ? homeTeam : teamId === awayTeamId ? awayTeam : "";
    const description = localizedName(
      event.EventDescription as LocalizedItem[] | LocalizedItem | undefined,
    );
    const scorer = parseScorer(description) || "Unknown scorer";

    goals.push({
      eventId: String(event.EventId ?? `${event.MatchMinute}:${scorer}`),
      minute: String(event.MatchMinute ?? "?"),
      scorer,
      teamName,
      teamId,
      ownGoal:
        eventType === OWN_GOAL_EVENT_TYPE ||
        OWN_GOAL_DESCRIPTION.test(description),
    });
  }

  return goals;
}

function calendarRowToMatch(
  row: FifaJson,
  competition: FootballCompetition,
): FootballMatch {
  const home = (row.Home as FifaJson | undefined) ?? {};
  const away = (row.Away as FifaJson | undefined) ?? {};
  const homeLabels = fifaTeamLabels(home);
  const awayLabels = fifaTeamLabels(away);
  const period =
    row.Period == null || row.Period === "" ? null : Number(row.Period);
  const matchTimeRaw = row.MatchTime ?? row.MatchTimeShort;
  const matchTime =
    matchTimeRaw == null || String(matchTimeRaw).trim() === ""
      ? null
      : String(matchTimeRaw);

  return {
    id: `fifa:${row.IdMatch}`,
    homeTeam: homeLabels.name,
    awayTeam: awayLabels.name,
    homeTeamCode: homeLabels.code,
    awayTeamCode: awayLabels.code,
    homeFlag: homeLabels.flag,
    awayFlag: awayLabels.flag,
    utcDate: parseDatetime(row.Date as string | undefined),
    status: mapFifaStatus(Number.isFinite(period) ? period : null),
    competitionId: String(row.IdCompetition ?? competition.id),
    competition: competitionLabelFifa(row, competition),
    homeScore: scoreFromSide(home),
    awayScore: scoreFromSide(away),
    matchTime,
    period: Number.isFinite(period) ? period : null,
    stage:
      localizedName(row.StageName as LocalizedItem[] | undefined) ||
      localizedName(row.GroupName as LocalizedItem[] | undefined) ||
      null,
    goals: [],
    provider: "fifa",
  };
}

function espnEventToMatch(
  event: EspnJson,
  competition: FootballCompetition,
): FootballMatch | null {
  const competitions = (event.competitions as EspnJson[] | undefined) ?? [];
  const comp = competitions[0] ?? {};
  const competitors = (comp.competitors as EspnJson[] | undefined) ?? [];
  const home =
    competitors.find((c) => c.homeAway === "home") ?? competitors[0] ?? {};
  const away =
    competitors.find((c) => c.homeAway === "away") ?? competitors[1] ?? {};
  const homeTeam = (home.team as EspnJson | undefined) ?? {};
  const awayTeam = (away.team as EspnJson | undefined) ?? {};

  const homeName = String(
    homeTeam.displayName ?? homeTeam.shortDisplayName ?? "Home",
  );
  const awayName = String(
    awayTeam.displayName ?? awayTeam.shortDisplayName ?? "Away",
  );
  const homeCode = String(homeTeam.abbreviation ?? "").toUpperCase();
  const awayCode = String(awayTeam.abbreviation ?? "").toUpperCase();
  const homeLabels = teamLabelsFromCode(homeCode, homeName, {
    treatAsClub: true,
  });
  const awayLabels = teamLabelsFromCode(awayCode, awayName, {
    treatAsClub: true,
  });

  const statusObj = (comp.status as EspnJson | undefined) ?? {};
  const statusType = (statusObj.type as EspnJson | undefined) ?? {};
  const stateName = String(statusType.name ?? statusType.state ?? "");
  const clock = statusObj.displayClock;
  const detail = String(statusType.detail ?? "");

  const homeScoreRaw = home.score;
  const awayScoreRaw = away.score;
  const homeScore =
    homeScoreRaw == null || homeScoreRaw === ""
      ? null
      : Number(homeScoreRaw);
  const awayScore =
    awayScoreRaw == null || awayScoreRaw === ""
      ? null
      : Number(awayScoreRaw);

  const eventId = String(event.id ?? "");
  if (!eventId) return null;

  return {
    id: `espn:${competition.id}:${eventId}`,
    homeTeam: homeLabels.name || homeName,
    awayTeam: awayLabels.name || awayName,
    homeTeamCode: homeLabels.code,
    awayTeamCode: awayLabels.code,
    homeFlag: homeLabels.flag,
    awayFlag: awayLabels.flag,
    utcDate: parseDatetime(String(event.date ?? "")),
    status: mapEspnStatus(stateName || detail),
    competitionId: competition.id,
    competition: competition.nameHe || competition.nameEn,
    homeScore: Number.isFinite(homeScore) ? homeScore : null,
    awayScore: Number.isFinite(awayScore) ? awayScore : null,
    matchTime:
      clock == null || String(clock).trim() === "" ? null : String(clock),
    period: null,
    stage: null,
    goals: [],
    provider: "espn",
  };
}

function dayOffsetToDate(dayOffset: number): Date {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + dayOffset);
  return day;
}

async function getEspnCalendarForCompetition(
  competition: FootballCompetition,
  dayOffsets: number[],
  fresh: boolean,
): Promise<FootballMatch[]> {
  const batches = await Promise.all(
    dayOffsets.map(async (offset) => {
      try {
        const scoreboard = await getEspnScoreboard(competition.id, {
          date: dayOffsetToDate(offset),
          fresh,
        });
        return espnScoreboardEvents(scoreboard)
          .map((event) => espnEventToMatch(event, competition))
          .filter((match): match is FootballMatch => Boolean(match));
      } catch {
        return [] as FootballMatch[];
      }
    }),
  );

  // Also pull "default" scoreboard (current slate) once.
  try {
    const scoreboard = await getEspnScoreboard(competition.id, { fresh });
    batches.push(
      espnScoreboardEvents(scoreboard)
        .map((event) => espnEventToMatch(event, competition))
        .filter((match): match is FootballMatch => Boolean(match)),
    );
  } catch {
    // ignore
  }

  return batches.flat();
}

async function getFifaCalendarForCompetition(
  competition: FootballCompetition,
  dayOffset: number,
  fresh: boolean,
): Promise<FootballMatch[]> {
  try {
    const rows = await getCalendarMatchesForDayOffset(dayOffset, {
      fresh,
      idCompetition: competition.id,
      idSeason: competition.seasonId ?? FIFA_LIVE_DEFAULTS.idSeason,
      count: FIFA_LIVE_DEFAULTS.count,
      language: FIFA_LIVE_DEFAULTS.language,
    });
    return rows.map((row) => calendarRowToMatch(row, competition));
  } catch {
    return [];
  }
}

async function enrichFifaLiveMatch(
  match: FootballMatch,
  fresh: boolean,
): Promise<FootballMatch> {
  const fifaId = match.id.replace(/^fifa:/, "");
  try {
    const [live, timeline] = await Promise.all([
      getLiveFootballMatch(fifaId, { fresh }),
      getMatchTimeline(fifaId, { fresh }).catch(() => ({ Event: [] })),
    ]);

    const home = (live.HomeTeam as FifaJson | undefined) ?? {};
    const away = (live.AwayTeam as FifaJson | undefined) ?? {};
    const homeTeamId = String(home.IdTeam ?? "");
    const awayTeamId = String(away.IdTeam ?? "");
    const period =
      live.Period == null || live.Period === "" ? null : Number(live.Period);
    const matchTimeRaw = live.MatchTime ?? live.MatchTimeShort;

    const homeScore =
      typeof live.HomeTeamScore === "number"
        ? live.HomeTeamScore
        : scoreFromSide(home) ?? match.homeScore;
    const awayScore =
      typeof live.AwayTeamScore === "number"
        ? live.AwayTeamScore
        : scoreFromSide(away) ?? match.awayScore;

    const goals = parseGoalsFromTimeline(
      timeline,
      homeTeamId,
      awayTeamId,
      match.homeTeam,
      match.awayTeam,
    );

    return {
      ...match,
      homeScore,
      awayScore,
      period: Number.isFinite(period) ? period : match.period,
      status: mapFifaStatus(
        Number.isFinite(period) ? (period as number) : match.period,
      ),
      matchTime:
        matchTimeRaw == null || String(matchTimeRaw).trim() === ""
          ? match.matchTime
          : String(matchTimeRaw),
      goals: goals.filter((goal) => !isPlaceholderScorer(goal.scorer)),
    };
  } catch {
    return match;
  }
}

async function enrichMatch(
  match: FootballMatch,
  fresh: boolean,
): Promise<FootballMatch> {
  if (match.provider === "fifa") return enrichFifaLiveMatch(match, fresh);
  // ESPN scoreboard already has live score/clock.
  return match;
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

/** Calendar matches across enabled competitions. */
export async function fetchFootballCalendar(
  dayOffsets: number[],
  fresh = false,
): Promise<FootballMatch[]> {
  const competitions = getEnabledFootballCompetitions();
  const jobs: Promise<FootballMatch[]>[] = [];

  for (const competition of competitions) {
    if (competition.provider === "espn") {
      jobs.push(getEspnCalendarForCompetition(competition, dayOffsets, fresh));
    } else {
      for (const offset of dayOffsets) {
        jobs.push(getFifaCalendarForCompetition(competition, offset, fresh));
      }
    }
  }

  const batches = await Promise.all(jobs);
  return dedupeMatches(batches.flat());
}

/** Live / pause matches right now. */
export async function fetchLiveFootballMatches(
  fresh = false,
): Promise<FootballMatch[]> {
  const now = Date.now();
  const calendar = await fetchFootballCalendar([0, -1, 1], fresh);
  const candidates = calendar.filter((match) => {
    const kickoff = match.utcDate.getTime();
    return kickoff <= now + 15 * 60 * 1000 && kickoff >= now - 5 * 60 * 60 * 1000;
  });

  const enriched = await Promise.all(
    candidates.map((match) => enrichMatch(match, fresh)),
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
    fetchFootballCalendar([-1, 0, 1, 2, 7, 14, 21, 28], fresh),
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
    // Include matches up to ~75 min ahead so 60-minute reminders fire.
    return kickoff >= now - 4 * 60 * 60 * 1000 && kickoff <= now + 75 * 60 * 1000;
  });

  const enriched = await Promise.all(
    windowed.map((match) => enrichMatch(match, fresh)),
  );
  return dedupeMatches(enriched);
}
