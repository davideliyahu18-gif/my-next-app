import { collectFootballBotAlerts } from "./alerts";
import type { FootballBotPollSummary } from "./types";

export async function runFootballBotPoll(options?: {
  /** When true, only compute alerts — Baileys sender will deliver them. */
  dryNotify?: boolean;
}): Promise<FootballBotPollSummary> {
  const checkedAt = new Date().toISOString();
  const { alerts, liveMatches, upcomingMatches } =
    await collectFootballBotAlerts();

  return {
    ok: true,
    checkedAt,
    liveMatches,
    upcomingMatches,
    alerts,
    notified: options?.dryNotify ? 0 : 0,
  };
}
