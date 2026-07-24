import { collectFifaBotAlerts } from "./alerts";
import { processPendingHighlightVideos } from "./highlight-pipeline";
import {
  isFifaBotNotificationConfigured,
  notifyFifaBotAlerts,
} from "./notify";
import { isHotpathLockActive } from "./send-dedupe";
import type { FifaBotPollSummary } from "./types";

export async function runFifaBotPoll(options?: {
  /** When true, only compute alerts — caller (Baileys) will send them. */
  dryNotify?: boolean;
}): Promise<FifaBotPollSummary> {
  const checkedAt = new Date().toISOString();
  const { alerts, liveMatches, upcomingMatches } = await collectFifaBotAlerts();

  const deferredToHotpath = isHotpathLockActive();
  const dryNotify = Boolean(options?.dryNotify || deferredToHotpath);

  let notified = 0;
  if (!dryNotify && alerts.length > 0) {
    if (isFifaBotNotificationConfigured()) {
      notified = await notifyFifaBotAlerts(alerts);
    } else {
      console.warn(
        "[fifa-bot] Alerts ready but no Green API / Telegram channel configured.",
      );
    }
  }

  // After every match: keep probing FOX for the official ~4-min recap and send
  // video to LIVE + VIP (compress via ffmpeg when available).
  if (!dryNotify && isFifaBotNotificationConfigured()) {
    try {
      const highlights = await processPendingHighlightVideos();
      if (highlights.sentVideo || highlights.sentLink) {
        notified += highlights.sentVideo + highlights.sentLink;
        console.log("[fifa-bot] highlights", highlights);
      }
    } catch (error) {
      console.error("[fifa-bot] highlight pipeline error:", error);
    }
  }

  if (deferredToHotpath && alerts.length) {
    console.log(
      "[fifa-bot] deferred",
      alerts.length,
      "alerts to hotpath (lock active)",
    );
  }

  return {
    ok: true,
    checkedAt,
    liveMatches,
    upcomingMatches,
    // Hide alert payloads from poller fallback fan-out while hotpath owns sends.
    alerts: deferredToHotpath ? [] : alerts,
    notified: dryNotify ? 0 : notified,
    deferredToHotpath,
  };
}
