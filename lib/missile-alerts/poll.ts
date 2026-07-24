import { fetchTelegramLaunchMessages } from "@/lib/rockets/telegram";
import {
  createDemoMissileAlert,
  messagesToMissileAlerts,
} from "./format";
import {
  isMissileNotificationConfigured,
  notifyMissileAlert,
} from "./notify";
import { hasSeenAlert, markAlertsSeen } from "./store";

export type MissileAlertPollSummary = {
  ok: boolean;
  scanned: number;
  candidates: number;
  fresh: number;
  notified: number;
  dryNotify: boolean;
  configured: boolean;
  errors: string[];
  demo?: boolean;
  alertIds: string[];
};

export async function runMissileAlertPoll(options?: {
  dryNotify?: boolean;
  includeDemo?: boolean;
}): Promise<MissileAlertPollSummary> {
  const dryNotify = options?.dryNotify === true;
  const includeDemo = options?.includeDemo === true;
  const configured = isMissileNotificationConfigured();

  const { messages, errors } = await fetchTelegramLaunchMessages();
  let alerts = messagesToMissileAlerts(messages);

  if (includeDemo) {
    alerts = [createDemoMissileAlert(), ...alerts];
  }

  const fresh = [];
  for (const alert of alerts) {
    if (await hasSeenAlert(alert.id)) continue;
    fresh.push(alert);
  }

  let notified = 0;
  const alertIds = fresh.map((alert) => alert.id);

  if (!dryNotify && fresh.length > 0) {
    if (!configured) {
      return {
        ok: true,
        scanned: messages.length,
        candidates: alerts.length,
        fresh: fresh.length,
        notified: 0,
        dryNotify,
        configured,
        errors: [
          ...errors,
          "No WhatsApp/Telegram channel configured (GREEN_API_* or TELEGRAM_*)",
        ],
        alertIds,
      };
    }

    for (const alert of fresh) {
      const result = await notifyMissileAlert(alert);
      if (result.whatsapp || result.telegram) {
        notified += 1;
        await markAlertsSeen([alert.id]);
      }
    }
  } else if (dryNotify && fresh.length > 0) {
    // Dry run still marks nothing; just report.
  }

  return {
    ok: true,
    scanned: messages.length,
    candidates: alerts.length,
    fresh: fresh.length,
    notified,
    dryNotify,
    configured,
    errors,
    demo: includeDemo,
    alertIds,
  };
}
