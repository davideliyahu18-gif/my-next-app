import { createDemoTracks, LAUNCH_SITES } from "./data";
import {
  aggregateActiveAreas,
  isLaunchRelated,
  messagesToTracks,
} from "./parse-alert";
import { fetchTelegramLaunchMessages } from "./telegram";
import type { RocketsSnapshot } from "./types";

/** Poll interval for SSE clients — keep tight so nothing is missed for long. */
export const ROCKETS_POLL_MS = 8_000;

export async function getRocketsSnapshot(options?: {
  allowDemoFallback?: boolean;
}): Promise<RocketsSnapshot> {
  const allowDemoFallback = options?.allowDemoFallback !== false;
  const timestamp = new Date().toISOString();

  try {
    const { messages, sources, errors, scanned } =
      await fetchTelegramLaunchMessages();
    const tracks = messagesToTracks(messages, new Date(), {
      maxAgeHours: 72,
    });
    const activeAreas = aggregateActiveAreas(tracks);

    // Every scraped message goes into the feed (no filtering out).
    const feed = messages.map((message) => ({
      id: message.id,
      channel: message.channel,
      url: message.url,
      text: message.text,
      datetime: message.datetime,
      related: isLaunchRelated(message.text),
      imageUrl: message.imageUrl,
    }));

    const stats = {
      scanned,
      feed: feed.length,
      related: feed.filter((item) => item.related).length,
      tracks: tracks.length,
    };

    if (tracks.length > 0 || feed.length > 0) {
      return {
        ok: true,
        mode: "live",
        tracks,
        feed,
        activeAreas,
        sources,
        errors,
        timestamp,
        stats,
      };
    }

    if (!allowDemoFallback) {
      return {
        ok: true,
        mode: "live",
        tracks: [],
        feed,
        activeAreas: [],
        sources,
        errors,
        timestamp,
        stats,
      };
    }

    const demoTracks = createDemoTracks();
    return {
      ok: true,
      mode: "demo",
      tracks: demoTracks,
      feed,
      activeAreas: aggregateActiveAreas(demoTracks),
      sources,
      errors: [
        ...errors,
        "לא נמצאו דיווחים — מציג הדגמה עד לעדכון הבא",
      ],
      timestamp,
      stats,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Telegram fetch failed";
    const demoTracks = createDemoTracks();
    return {
      ok: false,
      mode: "demo",
      tracks: demoTracks,
      feed: [],
      activeAreas: aggregateActiveAreas(demoTracks),
      sources: [],
      errors: [message],
      timestamp,
      stats: { scanned: 0, feed: 0, related: 0, tracks: 0 },
    };
  }
}

export { LAUNCH_SITES };
