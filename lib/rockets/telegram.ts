export type TelegramChannelMessage = {
  id: string;
  channel: string;
  url: string;
  text: string;
  datetime: string;
};

const CHANNELS = [
  { username: "newsil5", label: "מודיעין גלוי" },
  { username: "shigurimisrael", label: "התרעות שיגורים" },
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
    if (!textMatch || !datetimeMatch) continue;

    const text = stripHtml(textMatch[1]);
    if (!text) continue;

    const url =
      linkMatch?.[1] ??
      `https://t.me/${username}/${datetimeMatch[1].replace(/\W/g, "")}`;
    const idMatch = url.match(/\/(\d+)$/);
    const id = `${username}:${idMatch?.[1] ?? datetimeMatch[1]}`;

    messages.push({
      id,
      channel: username,
      url,
      text,
      datetime: datetimeMatch[1],
    });
  }

  // Newest last in telegram preview; keep unique by id
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
  const response = await fetch(`https://t.me/s/${username}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RocketTrackBot/1.0; +https://vercel.app)",
      Accept: "text/html,application/xhtml+xml",
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

  all.sort((a, b) => Date.parse(b.datetime) - Date.parse(a.datetime));

  return {
    messages: all,
    sources: CHANNELS.map((c) => ({ username: c.username, label: c.label })),
    errors,
  };
}

export { CHANNELS };
