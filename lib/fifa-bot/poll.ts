import { collectFifaBotAlerts } from "./alerts";
import {
  isFifaBotNotificationConfigured,
  notifyFifaBotAlerts,
} from "./notify";
import type { FifaBotPollSummary } from "./types";

export async function runFifaBotPoll(options?: {
  /** When true, only compute alerts — caller (Baileys) will send them. */
  dryNotify?: boolean;
}): Promise<FifaBotPollSummary> {
  const checkedAt = new Date().toISOString();
  const { alerts, liveMatches, upcomingMatches } = await collectFifaBotAlerts();

  let notified = 0;
  if (!options?.dryNotify && alerts.length > 0) {
    if (isFifaBotNotificationConfigured()) {
      notified = await notifyFifaBotAlerts(alerts);
    } else {
      console.warn(
        "[fifa-bot] Alerts ready but no Green API / Telegram channel configured.",
      );
    }
  }

  return {
    ok: true,
    checkedAt,
    liveMatches,
    upcomingMatches,
    alerts,
    notified: options?.dryNotify ? 0 : notified,
  };
}
