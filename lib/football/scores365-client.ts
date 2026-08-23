/**
 * 365scores public web API (no key required).
 * https://webws.365scores.com/web/
 */

const SCORES365_BASE =
  process.env.SCORES365_BASE_URL?.replace(/\/$/, "") ||
  "https://webws.365scores.com/web";

const DEFAULT_PARAMS = {
  langId: process.env.SCORES365_LANG_ID ?? "2",
  timezoneName: process.env.SCORES365_TIMEZONE ?? "Asia/Jerusalem",
  userCountryId: process.env.SCORES365_COUNTRY_ID ?? "6",
};

export type Scores365Json = Record<string, unknown>;

export class Scores365Error extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly path?: string,
  ) {
    super(message);
    this.name = "Scores365Error";
  }
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function scores365Get(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  options?: { fresh?: boolean },
): Promise<Scores365Json> {
  const url = new URL(`${SCORES365_BASE}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(DEFAULT_PARAMS)) {
    url.searchParams.set(key, value);
  }
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.SCORES365_TIMEOUT_MS || 12_000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; MondialLeagues/1.0; +https://my-next-app-5jte.vercel.app)",
      },
      signal: controller.signal,
      ...(options?.fresh
        ? { cache: "no-store" as const }
        : { next: { revalidate: 60 } }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "365scores fetch failed";
    throw new Scores365Error(
      `365scores timeout/network for ${path}: ${message}`,
      undefined,
      path,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Scores365Error(
      `365scores ${response.status} for ${path}`,
      response.status,
      path,
    );
  }

  return (await response.json()) as Scores365Json;
}

export async function getScores365Games(options: {
  competitionIds: string;
  startDate: Date;
  endDate: Date;
  onlyLive?: boolean;
  fresh?: boolean;
}): Promise<Scores365Json> {
  return scores365Get(
    "games/",
    {
      sports: 1,
      competitions: options.competitionIds,
      startDate: toIsoDate(options.startDate),
      endDate: toIsoDate(options.endDate),
      onlyLiveGames: options.onlyLive ? true : undefined,
    },
    { fresh: options.fresh },
  );
}

export async function getScores365Standings(
  competitionId: number,
  options?: { fresh?: boolean },
): Promise<Scores365Json> {
  return scores365Get(
    "standings/",
    { competitions: competitionId },
    { fresh: options?.fresh },
  );
}
