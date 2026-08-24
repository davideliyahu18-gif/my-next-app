import {
  ALL_FOOTBALL_COMPETITIONS,
  getDomesticAndUclIdsCsv,
  LEAGUE_BY_ID,
} from "./competitions";
import { parseGame, type LeagueMatchView } from "./leagues-data";
import {
  getScores365Game,
  getScores365Games,
  getScores365Standings,
  type Scores365Json,
} from "./scores365-client";
import { scores365CompetitorLogoUrl } from "./team-logo";

/** Friendly shortcuts → 365scores nameForURL slugs */
const CLUB_SLUG_ALIASES: Record<string, string> = {
  barcelona: "fc-barcelona",
  barca: "fc-barcelona",
  city: "manchester-city",
  united: "manchester-united",
  madrid: "real-madrid",
  liverpool: "liverpool",
  arsenal: "arsenal",
  chelsea: "chelsea",
  "real-madrid": "real-madrid",
  "manchester-city": "manchester-city",
};

export type MatchEventKind = "goal" | "yellow" | "red" | "sub" | "other";

export interface MatchEventView {
  id: string;
  minute: string;
  teamId: number;
  teamName: string;
  playerName: string | null;
  kind: MatchEventKind;
  label: string;
  subLabel: string | null;
}

export interface MatchSquadPlayer {
  name: string;
  shortName: string;
  number: number | null;
}

export interface PitchPlayerView {
  id: string;
  name: string;
  shortName: string;
  number: number | null;
  side: "home" | "away";
  /** 0 = own goal line, 100 = attacking end */
  fieldLine: number;
  /** 0 = left touchline, 100 = right */
  fieldSide: number;
  positionName: string | null;
}

export interface PitchFormationView {
  homeFormation: string | null;
  awayFormation: string | null;
  players: PitchPlayerView[];
}

export interface LiveMatchCenterView {
  id: string;
  leagueSlug: string;
  leagueName: string;
  leagueFlag: string;
  home: {
    id: number;
    slug: string;
    name: string;
    logo: string | null;
    score: number | null;
  };
  away: {
    id: number;
    slug: string;
    name: string;
    logo: string | null;
    score: number | null;
  };
  status: "live" | "upcoming" | "finished";
  statusLabel: string;
  minute: string;
  kickoffAt: string;
  venue: {
    name: string;
    capacity: number | null;
  } | null;
  events: MatchEventView[];
  lastEvent: MatchEventView | null;
  lineups: {
    home: MatchSquadPlayer[];
    away: MatchSquadPlayer[];
  };
  pitch: PitchFormationView;
  fetchedAt: string;
}

export interface ClubProfileView {
  id: number;
  slug: string;
  name: string;
  logo: string | null;
  leagueSlug: string;
  leagueName: string;
  leagueFlag: string;
  liveMatch: LeagueMatchView | null;
  upcoming: LeagueMatchView[];
  recent: LeagueMatchView[];
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

function mapEventKind(eventTypeId: number): MatchEventKind {
  if (eventTypeId === 1) return "goal";
  if (eventTypeId === 2) return "yellow";
  if (eventTypeId === 3) return "red";
  if (eventTypeId === 1000) return "sub";
  return "other";
}

function mapStatus(
  statusGroup: number,
  statusText: string,
): { status: LiveMatchCenterView["status"]; label: string } {
  const text = statusText.trim();
  if (statusGroup === 3 || /חי|live|שידור/i.test(text)) {
    return { status: "live", label: text || "LIVE" };
  }
  if (statusGroup === 4 || /הסתיים|סיום|final|finished/i.test(text)) {
    return { status: "finished", label: text || "הסתיים" };
  }
  return { status: "upcoming", label: text || "טרם החל" };
}

function parsePitchSide(
  competitor: Scores365Json,
  side: "home" | "away",
  rosterById: Map<
    number,
    { name: string; shortName: string; number: number | null }
  >,
): { formation: string | null; players: PitchPlayerView[] } {
  const lineups = asRecord(competitor.lineups) ?? {};
  const formation = lineups.formation ? String(lineups.formation) : null;
  const members = Array.isArray(lineups.members)
    ? (lineups.members as Scores365Json[])
    : [];

  const players: PitchPlayerView[] = [];
  for (const member of members) {
    const status = Number(member.status ?? 0);
    // 1 = starting XI
    if (status !== 1) continue;

    const yard = asRecord(member.yardFormation) ?? {};
    if (yard.fieldLine == null || yard.fieldSide == null) continue;

    const fieldLine = Number(yard.fieldLine);
    const fieldSide = Number(yard.fieldSide);
    if (!Number.isFinite(fieldLine) || !Number.isFinite(fieldSide)) continue;

    const id = Number(member.id ?? 0);
    const roster = id > 0 ? rosterById.get(id) : undefined;
    const position = asRecord(member.position) ?? asRecord(member.formation) ?? {};
    const fallbackName = String(position.name ?? position.shortName ?? "").trim();

    players.push({
      id: `${side}-${id || players.length}`,
      name: roster?.name || fallbackName || "שחקן",
      shortName:
        roster?.shortName ||
        String(position.shortName ?? fallbackName ?? "שחקן"),
      number: roster?.number ?? null,
      side,
      fieldLine: Math.min(100, Math.max(0, fieldLine)),
      fieldSide: Math.min(100, Math.max(0, fieldSide)),
      positionName: position.name ? String(position.name) : null,
    });
  }

  return { formation, players };
}

function addDays(base: Date, days: number): Date {
  const copy = new Date(base);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function parseEvents(
  rawEvents: Scores365Json[],
  home: Scores365Json,
  away: Scores365Json,
  players: Map<number, string>,
): MatchEventView[] {
  const homeId = Number(home.id ?? 0);
  const homeName = String(home.name ?? "");
  const awayName = String(away.name ?? "");

  return rawEvents
    .map((event, index) => {
      const eventType = asRecord(event.eventType) ?? {};
      const typeId = Number(eventType.id ?? 0);
      const teamId = Number(event.competitorId ?? 0);
      const playerId = Number(event.playerId ?? 0);
      const minute = String(
        event.gameTimeDisplay ?? event.gameTime ?? "",
      ).trim();
      const label = String(eventType.name ?? "אירוע");
      const subLabel = eventType.subTypeName
        ? String(eventType.subTypeName)
        : null;

      return {
        id: `${teamId}-${minute}-${typeId}-${index}`,
        minute: minute || "—",
        teamId,
        teamName: teamId === homeId ? homeName : awayName,
        playerName: playerId > 0 ? players.get(playerId) ?? null : null,
        kind: mapEventKind(typeId),
        label,
        subLabel,
      };
    })
    .sort((a, b) => {
      const parseMin = (value: string) =>
        Number.parseInt(value.replace(/[^\d]/g, ""), 10) || 0;
      return parseMin(a.minute) - parseMin(b.minute);
    });
}

export async function fetchMatchCenter(
  gameId: string,
  fresh = false,
): Promise<LiveMatchCenterView | null> {
  const payload = await getScores365Game(gameId, { fresh });
  const game = asRecord(payload.game);
  if (!game) return null;

  const competitionId = Number(game.competitionId ?? 0);
  const league = LEAGUE_BY_ID.get(competitionId);
  if (!league) return null;

  const home = asRecord(game.homeCompetitor) ?? {};
  const away = asRecord(game.awayCompetitor) ?? {};
  const homeName = String(home.name ?? "").trim();
  const awayName = String(away.name ?? "").trim();
  if (!homeName || !awayName) return null;

  const statusGroup = Number(game.statusGroup ?? 0);
  const statusText = String(game.statusText ?? game.shortStatusText ?? "");
  const mapped = mapStatus(statusGroup, statusText);

  const gameTime = game.gameTime;
  const minute =
    mapped.status === "live" && gameTime != null && Number(gameTime) > 0
      ? `${Math.trunc(Number(gameTime))}'`
      : mapped.status === "finished"
        ? "סיום"
        : "";

  const members = Array.isArray(game.members)
    ? (game.members as Scores365Json[])
    : [];
  const players = new Map<number, string>();
  const rosterById = new Map<
    number,
    { name: string; shortName: string; number: number | null }
  >();
  const lineups: LiveMatchCenterView["lineups"] = { home: [], away: [] };
  const homeId = Number(home.id ?? 0);
  const awayId = Number(away.id ?? 0);

  for (const member of members) {
    const athleteId = Number(member.athleteId ?? member.id ?? 0);
    const memberId = Number(member.id ?? 0);
    const name = String(member.name ?? "").trim();
    const shortName = String(member.shortName ?? name).trim();
    const number =
      member.jerseyNumber != null ? Number(member.jerseyNumber) : null;
    if (name) {
      if (athleteId > 0) players.set(athleteId, name);
      if (memberId > 0) players.set(memberId, name);
    }
    const roster = { name: name || shortName, shortName: shortName || name, number };
    if (athleteId > 0) rosterById.set(athleteId, roster);
    if (memberId > 0) rosterById.set(memberId, roster);

    const squadPlayer: MatchSquadPlayer = {
      name: roster.name,
      shortName: roster.shortName,
      number,
    };
    const competitorId = Number(member.competitorId ?? 0);
    if (competitorId === homeId) lineups.home.push(squadPlayer);
    else if (competitorId === awayId) lineups.away.push(squadPlayer);
  }

  lineups.home.sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
  lineups.away.sort((a, b) => (a.number ?? 99) - (b.number ?? 99));

  const homePitch = parsePitchSide(home, "home", rosterById);
  const awayPitch = parsePitchSide(away, "away", rosterById);
  const pitch: PitchFormationView = {
    homeFormation: homePitch.formation,
    awayFormation: awayPitch.formation,
    players: [...homePitch.players, ...awayPitch.players],
  };

  const rawEvents = Array.isArray(game.events)
    ? (game.events as Scores365Json[])
    : [];
  const events = parseEvents(rawEvents, home, away, players);
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;

  const venueRaw = asRecord(game.venue);
  const venueName = venueRaw ? String(venueRaw.name ?? "").trim() : "";
  const venueCapacity =
    venueRaw?.capacity != null ? Number(venueRaw.capacity) : null;

  return {
    id: String(game.id ?? gameId),
    leagueSlug: league.slug,
    leagueName: league.nameHe,
    leagueFlag: league.countryFlag,
    home: {
      id: homeId,
      slug: String(home.nameForURL ?? ""),
      name: homeName,
      logo: scores365CompetitorLogoUrl(
        home.id as string | number | null | undefined,
        home.imageVersion as string | number | null | undefined,
      ),
      score: parseScore(home.score),
    },
    away: {
      id: awayId,
      slug: String(away.nameForURL ?? ""),
      name: awayName,
      logo: scores365CompetitorLogoUrl(
        away.id as string | number | null | undefined,
        away.imageVersion as string | number | null | undefined,
      ),
      score: parseScore(away.score),
    },
    status: mapped.status,
    statusLabel: mapped.label,
    minute,
    kickoffAt: String(game.startTime ?? ""),
    venue: venueName
      ? {
          name: venueName,
          capacity:
            Number.isFinite(venueCapacity) && (venueCapacity as number) > 0
              ? Math.trunc(venueCapacity as number)
              : null,
        }
      : null,
    events,
    lastEvent,
    lineups,
    pitch,
    fetchedAt: new Date().toISOString(),
  };
}

async function findCompetitorInStandings(slug: string): Promise<{
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  leagueSlug: string;
  leagueName: string;
  leagueFlag: string;
} | null> {
  const normalized = slug.trim().toLowerCase();
  for (const league of ALL_FOOTBALL_COMPETITIONS) {
    const payload = await getScores365Standings(league.id, { fresh: true }).catch(
      () => ({ standings: [] }),
    );
    const rows = Array.isArray(payload.standings)
      ? ((payload.standings as Scores365Json[])[0]?.rows as Scores365Json[]) ?? []
      : [];
    for (const row of rows) {
      const competitor = asRecord(row.competitor) ?? {};
      const nameForUrl = String(competitor.nameForURL ?? "").toLowerCase();
      if (nameForUrl === normalized) {
        return {
          id: Number(competitor.id ?? 0),
          name: String(competitor.name ?? ""),
          slug: nameForUrl,
          logo: scores365CompetitorLogoUrl(
            competitor.id as string | number | null | undefined,
            competitor.imageVersion as string | number | null | undefined,
          ),
          leagueSlug: league.slug,
          leagueName: league.nameHe,
          leagueFlag: league.countryFlag,
        };
      }
    }
  }
  return null;
}

async function fetchCompetitorMatches(
  competitorId: number,
): Promise<LeagueMatchView[]> {
  const now = new Date();
  const payload = await getScores365Games({
    competitionIds: getDomesticAndUclIdsCsv(),
    startDate: addDays(now, -14),
    endDate: addDays(now, 21),
    fresh: true,
  });
  const games = Array.isArray(payload.games)
    ? (payload.games as Scores365Json[])
    : [];
  const matches: LeagueMatchView[] = [];

  for (const game of games) {
    const home = asRecord(game.homeCompetitor) ?? {};
    const away = asRecord(game.awayCompetitor) ?? {};
    const homeId = Number(home.id ?? 0);
    const awayId = Number(away.id ?? 0);
    if (homeId !== competitorId && awayId !== competitorId) continue;

    const competitionId = Number(game.competitionId ?? 0);
    const league = LEAGUE_BY_ID.get(competitionId);
    if (!league) continue;
    const parsed = parseGame(game, league);
    if (parsed) matches.push(parsed);
  }

  return matches.sort(
    (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
  );
}

export async function fetchClubProfile(
  slug: string,
): Promise<ClubProfileView | null> {
  const raw = slug.trim().toLowerCase();
  const resolved = CLUB_SLUG_ALIASES[raw] ?? raw;
  const club = await findCompetitorInStandings(resolved);
  if (!club || !club.id) return null;

  const matches = await fetchCompetitorMatches(club.id);
  const liveMatch =
    matches.find((match) => match.status === "live") ?? null;
  const upcoming = matches
    .filter((match) => match.status === "upcoming")
    .slice(0, 6);
  const recent = matches
    .filter((match) => match.status === "finished")
    .slice(-6)
    .reverse();

  return {
    id: club.id,
    slug: club.slug,
    name: club.name,
    logo: club.logo,
    leagueSlug: club.leagueSlug,
    leagueName: club.leagueName,
    leagueFlag: club.leagueFlag,
    liveMatch,
    upcoming,
    recent,
  };
}
