import { createDemoTracks, LAUNCH_SITES } from "./data";
import { isLaunchRelated, messagesToTracks } from "./parse-alert";
import { fetchTelegramLaunchMessages } from "./telegram";
import type { RocketsSnapshot } from "./types";

/** Poll interval for SSE clients. */
export const ROCKETS_POLL_MS = 12_000;

export async function getRocketsSnapshot(options?: {
  allowDemoFallback?: boolean;
}): Promise<RocketsSnapshot> {
  const allowDemoFallback = options?.allowDemoFallback !== false;
  const timestamp = new Date().toISOString();

  try {
    const { messages, sources, errors } = await fetchTelegramLaunchMessages();
    const tracks = messagesToTracks(messages, new Date(), {
      maxAgeHours: 48,
    });

    // Prefer newest posts; keep a generous live feed (not only launch-related).
    const feed = messages.slice(0, 40).map((message) => ({
      id: message.id,
      channel: message.channel,
      url: message.url,
      text: message.text,
      datetime: message.datetime,
      related: isLaunchRelated(message.text),
      imageUrl: message.imageUrl,
    }));

    if (tracks.length > 0 || feed.length > 0) {
      return {
        ok: true,
        mode: "live",
        tracks,
        feed,
        sources,
        errors,
        timestamp,
      };
    }

    if (!allowDemoFallback) {
      return {
        ok: true,
        mode: "live",
        tracks: [],
        feed,
        sources,
        errors,
        timestamp,
      };
    }

    return {
      ok: true,
      mode: "demo",
      tracks: createDemoTracks(),
      feed,
      sources,
      errors: [
        ...errors,
        "לא נמצאו דיווחי שיגור פעילים — מציג הדגמה עד לעדכון הבא",
      ],
      timestamp,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Telegram fetch failed";
    return {
      ok: false,
      mode: "demo",
      tracks: createDemoTracks(),
      feed: [],
      sources: [],
      errors: [message],
      timestamp,
    };
  }
}

export { LAUNCH_SITES };
