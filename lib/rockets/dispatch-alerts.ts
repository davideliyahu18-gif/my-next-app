import { areaMapUrl } from "@/lib/rockets/alert-areas";
import { filterUnsent, markAlertSent } from "@/lib/rockets/alert-dedupe";
import { isLaunchRelated, messagesToTracks } from "@/lib/rockets/parse-alert";
import { getRocketsSnapshot } from "@/lib/rockets/snapshot";
import {
  formatLaunchTelegramMessage,
  isTelegramNotifyConfigured,
  sendTelegramAlert,
} from "@/lib/rockets/telegram-notify";

export type NotifyDispatchResult = {
  configured: boolean;
  checked: number;
  related: number;
  sent: number;
  skipped: number;
  errors: string[];
  sentIds: string[];
};

export async function dispatchNewTelegramAlerts(options?: {
  /** Also notify non-launch messages (default: launch-related only). */
  allMessages?: boolean;
  limit?: number;
}): Promise<NotifyDispatchResult> {
  const allMessages = options?.allMessages === true;
  const limit = options?.limit ?? 12;

  if (!isTelegramNotifyConfigured()) {
    return {
      configured: false,
      checked: 0,
      related: 0,
      sent: 0,
      skipped: 0,
      errors: ["Telegram not configured"],
      sentIds: [],
    };
  }

  const snapshot = await getRocketsSnapshot({ allowDemoFallback: false });
  const candidates = snapshot.feed.filter((item) =>
    allMessages ? true : item.related || isLaunchRelated(item.text),
  );
  const unsentIds = await filterUnsent(candidates.map((c) => c.id));
  const queue = candidates
    .filter((c) => unsentIds.includes(c.id))
    .slice(0, limit);

  const tracks = messagesToTracks(
    queue.map((item) => ({
      id: item.id,
      channel: item.channel,
      url: item.url,
      text: item.text,
      datetime: item.datetime,
      imageUrl: item.imageUrl,
    })),
  );
  const trackBySource = new Map(
    tracks.map((track) => {
      const key = track.id.replace(/^tg-/, "");
      return [key, track] as const;
    }),
  );

  const errors: string[] = [];
  const sentIds: string[] = [];

  for (const item of queue) {
    const track = trackBySource.get(item.id);
    const primaryArea = track?.alertAreas?.[0];
    const text = formatLaunchTelegramMessage({
      text: item.text,
      channel: item.channel,
      url: item.url,
      originLabel: track?.originLabelHe,
      targetLabel: track?.targetLabelHe,
      areaLabels: track?.alertAreas?.map((a) => a.labelHe),
      shelterSeconds: track?.shelterSeconds,
      mapUrl: primaryArea ? areaMapUrl(primaryArea.id) : undefined,
      weaponHint: track?.speedHintHe,
    });
    const result = await sendTelegramAlert(text);
    if (result.ok) {
      await markAlertSent(item.id);
      sentIds.push(item.id);
    } else {
      errors.push(`${item.id}: ${result.error ?? "send failed"}`);
    }
  }

  return {
    configured: true,
    checked: snapshot.feed.length,
    related: candidates.length,
    sent: sentIds.length,
    skipped: Math.max(0, candidates.length - queue.length),
    errors,
    sentIds,
  };
}
