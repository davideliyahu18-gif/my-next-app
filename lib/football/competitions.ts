/**
 * FIFA competitions the football bot tracks via fifaLiveClient.
 * Default source: idCompetition=17, idSeason=285023 (World Cup).
 */

export interface FootballCompetition {
  id: string;
  nameHe: string;
  nameEn: string;
  /** FIFA season id (idSeason). */
  seasonId?: string;
  enabled: boolean;
}

/** Primary FIFA source from the live client defaults. */
export const DEFAULT_FOOTBALL_COMPETITIONS: FootballCompetition[] = [
  {
    id: process.env.FIFA_ID_COMPETITION ?? "17",
    nameHe: "גביע העולם",
    nameEn: "FIFA World Cup",
    seasonId: process.env.FIFA_ID_SEASON ?? "285023",
    enabled: true,
  },
];

function parseCompetitionsFromEnv(): FootballCompetition[] | null {
  const raw = process.env.FOOTBALL_FIFA_COMPETITIONS?.trim();
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
      competitions.push({
        id,
        nameHe: String(row.nameHe ?? row.name ?? id),
        nameEn: String(row.nameEn ?? row.name ?? id),
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
    // Comma-separated competition ids (season from FIFA_ID_SEASON)
    return raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => ({
        id,
        nameHe: id,
        nameEn: id,
        seasonId: process.env.FIFA_ID_SEASON ?? "285023",
        enabled: true,
      }));
  }
}

export function getEnabledFootballCompetitions(): FootballCompetition[] {
  const fromEnv = parseCompetitionsFromEnv();
  const list = fromEnv ?? DEFAULT_FOOTBALL_COMPETITIONS;
  return list.filter((competition) => competition.enabled);
}
