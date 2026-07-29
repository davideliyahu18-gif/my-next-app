/**
 * FIFA live client — exact source the football WhatsApp bot pulls from.
 *
 * Base: https://api.fifa.com/api/v3
 *  - GET /calendar/matches
 *  - GET /live/football/{fifaMatchId}
 *  - GET /timelines/{fifaMatchId}
 */

export const FIFA_LIVE_BASE_URL =
  process.env.FOOTBALL_FIFA_BASE_URL?.replace(/\/$/, "") ||
  process.env.FIFA_API_BASE_URL?.replace(/\/$/, "") ||
  "https://api.fifa.com/api/v3";

export const FIFA_LIVE_DEFAULTS = {
  language: process.env.FIFA_API_LANGUAGE ?? "en",
  count: Number(process.env.FOOTBALL_MATCH_COUNT ?? process.env.FIFA_MATCH_COUNT ?? "500"),
  idCompetition: process.env.FIFA_ID_COMPETITION ?? "17",
  idSeason: process.env.FIFA_ID_SEASON ?? "285023",
} as const;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export class FifaLiveClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly path?: string,
  ) {
    super(message);
    this.name = "FifaLiveClientError";
  }
}

export type FifaJson = Record<string, unknown>;

export interface FifaCalendarMatchesParams {
  language?: string;
  count?: number;
  idCompetition?: string;
  idSeason?: string;
  /** YYYY-MM-DD */
  from: string;
  /** YYYY-MM-DD */
  to: string;
}

function toDateOnly(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new FifaLiveClientError(`Invalid FIFA date: ${value}`);
  }
  return parsed.toISOString().slice(0, 10);
}

async function fifaGet(
  path: string,
  params?: Record<string, string | number | undefined>,
  options?: { fresh?: boolean; bustCache?: boolean },
): Promise<FifaJson> {
  const url = new URL(`${FIFA_LIVE_BASE_URL}/${path.replace(/^\//, "")}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  if (options?.bustCache) {
    url.searchParams.set("_", String(Date.now()));
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    ...(options?.fresh
      ? { cache: "no-store" as const }
      : { next: { revalidate: 30 } }),
  });

  if (!response.ok) {
    throw new FifaLiveClientError(
      `FIFA ${response.status} for ${path}: ${await response.text()}`,
      response.status,
      path,
    );
  }

  return (await response.json()) as FifaJson;
}

/**
 * Discover matches in a date range.
 * GET /calendar/matches?language&count&idCompetition&idSeason&from&to
 */
export async function getCalendarMatches(
  params: FifaCalendarMatchesParams,
  options?: { fresh?: boolean },
): Promise<FifaJson[]> {
  const data = await fifaGet(
    "calendar/matches",
    {
      language: params.language ?? FIFA_LIVE_DEFAULTS.language,
      count: params.count ?? FIFA_LIVE_DEFAULTS.count,
      idCompetition: params.idCompetition ?? FIFA_LIVE_DEFAULTS.idCompetition,
      idSeason: params.idSeason ?? FIFA_LIVE_DEFAULTS.idSeason,
      from: toDateOnly(params.from),
      to: toDateOnly(params.to),
    },
    { fresh: options?.fresh },
  );

  return (data.Results as FifaJson[] | undefined) ?? [];
}

/**
 * Live payload for one match.
 * GET /live/football/{fifaMatchId}?language&_={timestamp}
 */
export async function getLiveFootballMatch(
  fifaMatchId: string,
  options?: { language?: string; fresh?: boolean },
): Promise<FifaJson> {
  return fifaGet(
    `live/football/${fifaMatchId}`,
    {
      language: options?.language ?? FIFA_LIVE_DEFAULTS.language,
    },
    { fresh: options?.fresh ?? true, bustCache: true },
  );
}

/**
 * Event timeline for one match.
 * GET /timelines/{fifaMatchId}?language&_={timestamp}
 */
export async function getMatchTimeline(
  fifaMatchId: string,
  options?: { language?: string; fresh?: boolean },
): Promise<FifaJson> {
  return fifaGet(
    `timelines/${fifaMatchId}`,
    {
      language: options?.language ?? FIFA_LIVE_DEFAULTS.language,
    },
    { fresh: options?.fresh ?? true, bustCache: true },
  );
}

/** Convenience: calendar for a single UTC day offset from today. */
export async function getCalendarMatchesForDayOffset(
  dayOffset: number,
  options?: {
    fresh?: boolean;
    idCompetition?: string;
    idSeason?: string;
    count?: number;
    language?: string;
  },
): Promise<FifaJson[]> {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + dayOffset);
  const yyyyMmDd = day.toISOString().slice(0, 10);

  return getCalendarMatches(
    {
      from: yyyyMmDd,
      to: yyyyMmDd,
      idCompetition: options?.idCompetition,
      idSeason: options?.idSeason,
      count: options?.count,
      language: options?.language,
    },
    { fresh: options?.fresh },
  );
}

export const fifaLiveClient = {
  baseUrl: FIFA_LIVE_BASE_URL,
  defaults: FIFA_LIVE_DEFAULTS,
  getCalendarMatches,
  getLiveFootballMatch,
  getMatchTimeline,
  getCalendarMatchesForDayOffset,
};

export default fifaLiveClient;
