import {
  bridgeWhatsAppChatId,
  getBridgeChannels,
  isBridgeEnabled,
} from "./channels";
import { fetchBridgeChannels } from "./scrape";
import {
  filterUnsent,
  isBridgeBootstrapped,
  markBridgeBootstrapped,
  markMessagesSent,
} from "./store";
import type { BridgePollSummary } from "./types";
import {
  forwardMessageToWhatsApp,
  isGreenApiConfigured,
} from "./whatsapp";

export function isBridgeConfigured(): boolean {
  return (
    isBridgeEnabled() &&
    getBridgeChannels().length > 0 &&
    isGreenApiConfigured()
  );
}

export async function runBridgePoll(options?: {
  dryRun?: boolean;
  limit?: number;
  /** Force forward even on first run (default: bootstrap = mark history only). */
  forceBootstrapSend?: boolean;
}): Promise<BridgePollSummary> {
  const dryRun = options?.dryRun === true;
  const limit = options?.limit ?? 20;
  const channels = getBridgeChannels();
  const configured = isBridgeConfigured();

  if (!isBridgeEnabled()) {
    return {
      ok: false,
      configured: false,
      channels: [],
      scanned: 0,
      fresh: 0,
      sent: 0,
      skipped: 0,
      bootstrapped: false,
      dryRun,
      errors: ["TG_WA_BRIDGE_ENABLED=false"],
      sentIds: [],
    };
  }

  if (channels.length === 0) {
    return {
      ok: false,
      configured: false,
      channels: [],
      scanned: 0,
      fresh: 0,
      sent: 0,
      skipped: 0,
      bootstrapped: false,
      dryRun,
      errors: [
        "חסר TG_WA_CHANNELS — לדוגמה: TG_WA_CHANNELS=newsil5:מודיעין גלוי",
      ],
      sentIds: [],
    };
  }

  if (!bridgeWhatsAppChatId() || !isGreenApiConfigured()) {
    return {
      ok: false,
      configured: false,
      channels: channels.map((c) => c.username),
      scanned: 0,
      fresh: 0,
      sent: 0,
      skipped: 0,
      bootstrapped: false,
      dryRun,
      errors: [
        "חסר GREEN_API_INSTANCE / GREEN_API_TOKEN / TG_WA_WHATSAPP_CHAT_ID",
      ],
      sentIds: [],
    };
  }

  const { messages, errors } = await fetchBridgeChannels(channels);
  const unsentIds = await filterUnsent(messages.map((m) => m.id));
  const fresh = messages.filter((m) => unsentIds.includes(m.id));

  const bootstrapped = await isBridgeBootstrapped();
  if (!bootstrapped && !options?.forceBootstrapSend) {
    if (!dryRun && fresh.length > 0) {
      await markMessagesSent(fresh.map((m) => m.id));
      await markBridgeBootstrapped();
    }
    return {
      ok: true,
      configured,
      channels: channels.map((c) => c.username),
      scanned: messages.length,
      fresh: fresh.length,
      sent: 0,
      skipped: fresh.length,
      bootstrapped: true,
      dryRun,
      errors,
      sentIds: [],
    };
  }

  const queue = fresh.slice(-limit);
  const sentIds: string[] = [];
  let sent = 0;
  let skipped = Math.max(0, fresh.length - queue.length);
  const sendErrors = [...errors];

  if (dryRun) {
    return {
      ok: true,
      configured,
      channels: channels.map((c) => c.username),
      scanned: messages.length,
      fresh: fresh.length,
      sent: 0,
      skipped: fresh.length,
      bootstrapped,
      dryRun,
      errors: sendErrors,
      sentIds: queue.map((m) => m.id),
    };
  }

  for (const message of queue) {
    const result = await forwardMessageToWhatsApp(message);
    if (result.ok) {
      sent += 1;
      sentIds.push(message.id);
      await markMessagesSent([message.id]);
    } else {
      skipped += 1;
      sendErrors.push(
        `${message.id}: ${result.error || "שליחה לוואטסאפ נכשלה"}`,
      );
    }
  }

  if (!bootstrapped) {
    await markBridgeBootstrapped();
  }

  return {
    ok: sendErrors.length === errors.length,
    configured,
    channels: channels.map((c) => c.username),
    scanned: messages.length,
    fresh: fresh.length,
    sent,
    skipped,
    bootstrapped: true,
    dryRun,
    errors: sendErrors,
    sentIds,
  };
}
