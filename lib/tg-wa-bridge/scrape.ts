import type { BridgeChannelConfig, BridgeChannelMessage } from "./types";

/** How many preview pages to walk back per channel (≈20 msgs each). */
const PAGES_PER_CHANNEL = 2;

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function extractImage(block: string): string | undefined {
  const bg = block.match(
    /tgme_widget_message_photo_wrap[^>]*style="[^"]*background-image:url\('([^']+)'\)/,
  );
  if (bg?.[1]) return bg[1];
  const img = block.match(
    /<img[^>]+class="tgme_widget_message_photo"[^>]+src="([^"]+)"/,
  );
  if (img?.[1]) return img[1];
  const thumb = block.match(
    /tgme_widget_message_video_thumb[^>]*style="[^"]*background-image:url\('([^']+)'\)/,
  );
  return thumb?.[1];
}

function parseChannelHtml(
  html: string,
  channel: BridgeChannelConfig,
): { messages: BridgeChannelMessage[]; oldestId: number | null } {
  const blocks = html.split('class="tgme_widget_message_wrap');
  const messages: BridgeChannelMessage[] = [];
  let oldestId: number | null = null;
  const username = channel.username;

  for (const block of blocks.slice(1)) {
    const dataPost = block.match(
      new RegExp(`data-post="${username}/(\\d+)"`, "i"),
    );
    const datetimeMatch = block.match(/datetime="([^"]+)"/);
    const linkMatch = block.match(
      new RegExp(`href="(https://t\\.me/${username}/\\d+)"`, "i"),
    );
    const textMatch = block.match(
      /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/,
    );

    const postId = dataPost?.[1] ?? linkMatch?.[1]?.match(/\/(\d+)$/)?.[1];
    if (!postId && !datetimeMatch) continue;

    const numericId = postId ? Number(postId) : NaN;
    if (!Number.isNaN(numericId)) {
      oldestId =
        oldestId == null ? numericId : Math.min(oldestId, numericId);
    }

    const text = textMatch ? stripHtml(textMatch[1]) : "";
    const imageUrl = extractImage(block);
    const url =
      linkMatch?.[1] ??
      (postId
        ? `https://t.me/${username}/${postId}`
        : `https://t.me/s/${username}`);
    const id = `${username}:${postId ?? datetimeMatch?.[1] ?? messages.length}`;

    messages.push({
      id,
      channel: username,
      channelLabel: channel.label,
      url,
      text: text || (imageUrl ? "(מדיה ללא טקסט)" : "(הודעה ללא טקסט)"),
      datetime: datetimeMatch?.[1] ?? new Date().toISOString(),
      imageUrl,
    });
  }

  const byId = new Map<string, BridgeChannelMessage>();
  for (const message of messages) {
    byId.set(message.id, message);
  }

  return {
    messages: [...byId.values()],
    oldestId,
  };
}

async function fetchChannelPage(
  channel: BridgeChannelConfig,
  before?: number,
): Promise<{ messages: BridgeChannelMessage[]; oldestId: number | null }> {
  const username = channel.username;
  const base = before
    ? `https://t.me/s/${username}?before=${before}`
    : `https://t.me/s/${username}`;
  const url = `${base}${base.includes("?") ? "&" : "?"}t=${Date.now()}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Telegram fetch failed for ${username}: ${response.status}`);
  }

  const html = await response.text();
  return parseChannelHtml(html, channel);
}

export async function fetchBridgeChannel(
  channel: BridgeChannelConfig,
): Promise<BridgeChannelMessage[]> {
  const all = new Map<string, BridgeChannelMessage>();
  let before: number | undefined;

  for (let page = 0; page < PAGES_PER_CHANNEL; page += 1) {
    const { messages, oldestId } = await fetchChannelPage(channel, before);
    if (messages.length === 0) break;
    for (const message of messages) {
      all.set(message.id, message);
    }
    if (oldestId == null) break;
    before = oldestId;
  }

  return [...all.values()].sort(
    (a, b) => Date.parse(a.datetime) - Date.parse(b.datetime),
  );
}

export async function fetchBridgeChannels(
  channels: BridgeChannelConfig[],
): Promise<{ messages: BridgeChannelMessage[]; errors: string[] }> {
  const errors: string[] = [];
  const all: BridgeChannelMessage[] = [];

  await Promise.all(
    channels.map(async (channel) => {
      try {
        const messages = await fetchBridgeChannel(channel);
        all.push(...messages);
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : `Failed ${channel.username}`,
        );
      }
    }),
  );

  all.sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime));
  return { messages: all, errors };
}
