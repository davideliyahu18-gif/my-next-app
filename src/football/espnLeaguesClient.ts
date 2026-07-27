/**
 * ESPN soccer scoreboard client for domestic leagues.
 * Used for Premier League, La Liga, Serie A, Ligat Ha'Al.
 *
 * GET https://site.api.espn.com/apis/site/v2/sports/soccer/{leagueId}/scoreboard
 * Optional: ?dates=YYYYMMDD
 */

export const ESPN_SOCCER_BASE =
  process.env.FOOTBALL_ESPN_BASE_URL?.replace(/\/$/, "") ||
  "https://site.api.espn.com/apis/site/v2/sports/soccer";

/** Standings live under /apis/v2 (site/v2 returns empty {}). */
export const ESPN_SOCCER_STANDINGS_BASE =
  process.env.FOOTBALL_ESPN_STANDINGS_BASE_URL?.replace(/\/$/, "") ||
  "https://site.api.espn.com/apis/v2/sports/soccer";

export type EspnJson = Record<string, unknown>;

export class EspnClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly path?: string,
  ) {
    super(message);
    this.name = "EspnClientError";
  }
}

function toEspnDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10).replace(/-/g, "");
  }
  const trimmed = value.trim();
  if (/^\d{8}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed.replace(/-/g, "");
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new EspnClientError(`Invalid ESPN date: ${value}`);
  }
  return parsed.toISOString().slice(0, 10).replace(/-/g, "");
}

async function espnGet(
  path: string,
  params?: Record<string, string | number | undefined>,
  options?: { fresh?: boolean; baseUrl?: string },
): Promise<EspnJson> {
  const base = (options?.baseUrl || ESPN_SOCCER_BASE).replace(/\/$/, "");
  const url = new URL(`${base}/${path.replace(/^\//, "")}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.FOOTBALL_ESPN_TIMEOUT_MS || 12_000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
      ...(options?.fresh
        ? { cache: "no-store" as const }
        : { next: { revalidate: 30 } }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ESPN fetch failed";
    throw new EspnClientError(`ESPN timeout/network for ${path}: ${message}`, undefined, path);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new EspnClientError(
      `ESPN ${response.status} for ${path}: ${await response.text()}`,
      response.status,
      path,
    );
  }

  return (await response.json()) as EspnJson;
}

/** Scoreboard for one league / day. */
export async function getEspnScoreboard(
  leagueId: string,
  options?: { date?: string | Date; fresh?: boolean },
): Promise<EspnJson> {
  const params: Record<string, string | number | undefined> = {};
  if (options?.date) params.dates = toEspnDate(options.date);
  return espnGet(`${leagueId}/scoreboard`, params, { fresh: options?.fresh });
}

/** Match summary (rosters / lineups / boxscore). */
export async function getEspnSummary(
  leagueId: string,
  eventId: string,
  options?: { fresh?: boolean },
): Promise<EspnJson> {
  return espnGet(
    `${leagueId}/summary`,
    { event: eventId },
    { fresh: options?.fresh ?? true },
  );
}

/** League table / standings (current season). */
export async function getEspnStandings(
  leagueId: string,
  options?: { fresh?: boolean },
): Promise<EspnJson> {
  return espnGet(`${leagueId}/standings`, undefined, {
    fresh: options?.fresh ?? true,
    baseUrl: ESPN_SOCCER_STANDINGS_BASE,
  });
}

/** Events list from a scoreboard payload. */
export function espnScoreboardEvents(scoreboard: EspnJson): EspnJson[] {
  return (scoreboard.events as EspnJson[] | undefined) ?? [];
}

export const espnLeaguesClient = {
  baseUrl: ESPN_SOCCER_BASE,
  standingsBaseUrl: ESPN_SOCCER_STANDINGS_BASE,
  getEspnScoreboard,
  getEspnSummary,
  getEspnStandings,
  espnScoreboardEvents,
};

export default espnLeaguesClient;
