export type TelegramChannelMessage = {
  id: string;
  channel: string;
  url: string;
  text: string;
  datetime: string;
  imageUrl?: string;
};

const CHANNELS = [
  { username: "newsil5", label: "מודיעין גלוי", priority: 1 },
  { username: "shigurimisrael", label: "התרעות שיגורים", priority: 2 },
] as const;

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
  username: string,
): TelegramChannelMessage[] {
  const blocks = html.split('class="tgme_widget_message_wrap');
  const messages: TelegramChannelMessage[] = [];

  for (const block of blocks.slice(1)) {
    const textMatch = block.match(
      /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/,
    );
    const datetimeMatch = block.match(/datetime="([^"]+)"/);
    const linkMatch = block.match(
      new RegExp(`href="(https://t\\.me/${username}/\\d+)"`),
    );
    if (!datetimeMatch) continue;

    const text = textMatch ? stripHtml(textMatch[1]) : "";
    const imageUrl = extractImage(block);
    if (!text && !imageUrl) continue;

    const url =
      linkMatch?.[1] ??
      `https://t.me/${username}/${datetimeMatch[1].replace(/\W/g, "")}`;
    const idMatch = url.match(/\/(\d+)$/);
    const id = `${username}:${idMatch?.[1] ?? datetimeMatch[1]}`;

    messages.push({
      id,
      channel: username,
      url,
      text: text || "(מדיה)",
      datetime: datetimeMatch[1],
      imageUrl,
    });
  }

  const byId = new Map<string, TelegramChannelMessage>();
  for (const message of messages) {
    byId.set(message.id, message);
  }
  return [...byId.values()].sort(
    (a, b) => Date.parse(b.datetime) - Date.parse(a.datetime),
  );
}

async function fetchChannel(
  username: string,
): Promise<TelegramChannelMessage[]> {
  // bust CDN caches with a timestamp query (ignored by t.me, helps intermediaries)
  const url = `https://t.me/s/${username}?t=${Date.now()}`;
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
  return parseChannelHtml(html, username);
}

export async function fetchTelegramLaunchMessages(): Promise<{
  messages: TelegramChannelMessage[];
  sources: { username: string; label: string }[];
  errors: string[];
}> {
  const errors: string[] = [];
  const all: TelegramChannelMessage[] = [];

  await Promise.all(
    CHANNELS.map(async (channel) => {
      try {
        const messages = await fetchChannel(channel.username);
        all.push(...messages);
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : `Failed ${channel.username}`,
        );
      }
    }),
  );

  const priority = Object.fromEntries(
    CHANNELS.map((c) => [c.username, c.priority]),
  ) as Record<string, number>;

  all.sort((a, b) => {
    const dt = Date.parse(b.datetime) - Date.parse(a.datetime);
    if (dt !== 0) return dt;
    return (priority[a.channel] ?? 9) - (priority[b.channel] ?? 9);
  });

  return {
    messages: all,
    sources: CHANNELS.map((c) => ({ username: c.username, label: c.label })),
    errors,
  };
}

export { CHANNELS };
