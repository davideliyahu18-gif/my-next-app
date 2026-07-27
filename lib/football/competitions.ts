/**
 * Leagues tracked by the football WhatsApp bot.
 * Domestic leagues use ESPN; FIFA World Cup stays available via fifaLiveClient.
 */

export type FootballProvider = "espn" | "fifa";

export interface FootballCompetition {
  id: string;
  nameHe: string;
  nameEn: string;
  provider: FootballProvider;
  /** FIFA season id (idSeason) — only for provider=fifa. */
  seasonId?: string;
  enabled: boolean;
}

/** Default: English · Spanish · Israeli · Italian. */
export const DEFAULT_FOOTBALL_COMPETITIONS: FootballCompetition[] = [
  {
    id: "eng.1",
    nameHe: "פרמייר ליג (אנגלית)",
    nameEn: "English Premier League",
    provider: "espn",
    enabled: true,
  },
  {
    id: "esp.1",
    nameHe: "לה ליגה (ספרדית)",
    nameEn: "Spanish La Liga",
    provider: "espn",
    enabled: true,
  },
  {
    id: "isr.1",
    nameHe: "ליגת העל (ישראלית)",
    nameEn: "Israeli Premier League",
    provider: "espn",
    enabled: true,
  },
  {
    id: "ita.1",
    nameHe: "סרייה א׳ (איטלקית)",
    nameEn: "Italian Serie A",
    provider: "espn",
    enabled: true,
  },
];

function parseCompetitionsFromEnv(): FootballCompetition[] | null {
  const raw = process.env.FOOTBALL_FIFA_COMPETITIONS?.trim()
    || process.env.FOOTBALL_LEAGUES?.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.length) return null;

    const competitions: FootballCompetition[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const id = String(
        row.id ?? row.idCompetition ?? row.IdCompetition ?? "",
      ).trim();
      if (!id) continue;
      const providerRaw = String(row.provider ?? "").toLowerCase();
      const provider: FootballProvider =
        providerRaw === "fifa" || /^\d+$/.test(id) ? "fifa" : "espn";
      competitions.push({
        id,
        nameHe: String(row.nameHe ?? row.name ?? id),
        nameEn: String(row.nameEn ?? row.name ?? id),
        provider,
        seasonId: row.seasonId
          ? String(row.seasonId)
          : row.idSeason
            ? String(row.idSeason)
            : undefined,
        enabled: row.enabled !== false,
      });
    }
    return competitions.length ? competitions : null;
  } catch {
    // Comma-separated ESPN ids: eng.1,esp.1,isr.1,ita.1
    return raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => ({
        id,
        nameHe: id,
        nameEn: id,
        provider: (/^\d+$/.test(id) ? "fifa" : "espn") as FootballProvider,
        seasonId: process.env.FIFA_ID_SEASON,
        enabled: true,
      }));
  }
}

export function getEnabledFootballCompetitions(): FootballCompetition[] {
  const fromEnv = parseCompetitionsFromEnv();
  const list = fromEnv ?? DEFAULT_FOOTBALL_COMPETITIONS;
  return list.filter((competition) => competition.enabled);
}
