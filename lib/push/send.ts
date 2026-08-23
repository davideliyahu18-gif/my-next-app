import webpush from "web-push";
import {
  getVapidPrivateKey,
  getVapidPublicKey,
  getVapidSubject,
  isPushConfigured,
} from "./vapid";
import {
  listPushSubscribers,
  removePushSubscriber,
  type PushSubscriber,
} from "./store";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function configureWebPush(): void {
  if (!isPushConfigured()) {
    throw new Error("VAPID keys are not configured");
  }
  webpush.setVapidDetails(
    getVapidSubject().startsWith("mailto:") ||
      getVapidSubject().startsWith("http")
      ? getVapidSubject()
      : `mailto:${getVapidSubject()}`,
    getVapidPublicKey(),
    getVapidPrivateKey(),
  );
}

export async function sendPushToSubscriber(
  subscriber: PushSubscriber,
  payload: PushPayload,
): Promise<{ ok: boolean; gone?: boolean; error?: string }> {
  try {
    configureWebPush();
    await webpush.sendNotification(
      subscriber.subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || "/",
        tag: payload.tag || "football-realtime",
      }),
    );
    return { ok: true };
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : undefined;
    if (statusCode === 404 || statusCode === 410) {
      await removePushSubscriber(subscriber.endpoint);
      return { ok: false, gone: true, error: "Subscription expired" };
    }
    const message = error instanceof Error ? error.message : "Push failed";
    return { ok: false, error: message };
  }
}

export async function broadcastPush(
  payload: PushPayload,
  options?: { leagues?: string[] },
): Promise<{ sent: number; failed: number; total: number }> {
  const subscribers = await listPushSubscribers();
  const filtered = options?.leagues?.length
    ? subscribers.filter((subscriber) => {
        if (!subscriber.leagues.length) return true;
        return subscriber.leagues.some((league) =>
          options.leagues!.includes(league),
        );
      })
    : subscribers;

  let sent = 0;
  let failed = 0;
  for (const subscriber of filtered) {
    const result = await sendPushToSubscriber(subscriber, payload);
    if (result.ok) sent += 1;
    else failed += 1;
  }

  return { sent, failed, total: filtered.length };
}
