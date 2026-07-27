/**
 * FIFA competitions the multi-league football bot tracks.
 * Add IdCompetition (+ optional IdSeason) when you bring more FIFA sources.
 */

export interface FootballCompetition {
  id: string;
  nameHe: string;
  nameEn: string;
  /** Optional FIFA season id — leave empty to use live calendar defaults. */
  seasonId?: string;
  enabled: boolean;
}

/** Built-in FIFA competitions (expand when you paste more source ids). */
export const DEFAULT_FOOTBALL_COMPETITIONS: FootballCompetition[] = [
  {
    id: "17",
    nameHe: "גביע העולם",
    nameEn: "FIFA World Cup",
    seasonId: process.env.FIFA_ID_SEASON ?? "285023",
    enabled: true,
  },
  {
    id: "10005",
    nameHe: "גביע העולם למועדונים",
    nameEn: "FIFA Club World Cup",
    enabled: true,
  },
  {
    id: "158",
    nameHe: "המשחקים האולימפיים — גברים",
    nameEn: "Olympic Football Tournament Men",
    enabled: true,
  },
  {
    id: "103",
    nameHe: "גביע הקונפדרציות",
    nameEn: "FIFA Confederations Cup",
    enabled: false,
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
      const id = String(row.id ?? row.IdCompetition ?? "").trim();
      if (!id) continue;
      competitions.push({
        id,
        nameHe: String(row.nameHe ?? row.name ?? id),
        nameEn: String(row.nameEn ?? row.name ?? id),
        seasonId: row.seasonId ? String(row.seasonId) : undefined,
        enabled: row.enabled !== false,
      });
    }
    return competitions.length ? competitions : null;
  } catch {
    // Comma-separated ids: 17,10005,158
    return raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => ({
        id,
        nameHe: id,
        nameEn: id,
        enabled: true,
      }));
  }
}

export function getEnabledFootballCompetitions(): FootballCompetition[] {
  const fromEnv = parseCompetitionsFromEnv();
  const list = fromEnv ?? DEFAULT_FOOTBALL_COMPETITIONS;
  return list.filter((competition) => competition.enabled);
}
