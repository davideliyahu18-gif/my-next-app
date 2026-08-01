import { verifyBridgeAuth } from "@/lib/tg-wa-bridge/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function bridgeBotToken(): string {
  return (
    process.env.TG_WA_TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.ROCKETS_TELEGRAM_BOT_TOKEN ||
    ""
  ).trim();
}

function webhookSecret(): string {
  return (
    process.env.TG_WA_WEBHOOK_SECRET ||
    process.env.TELEGRAM_WEBHOOK_SECRET ||
    process.env.TG_WA_BRIDGE_SECRET ||
    process.env.FEED_API_SECRET ||
    ""
  ).trim();
}

/**
 * Register Telegram webhook for channel_post (instant forward).
 * POST body optional: { "url": "https://your-app.vercel.app/api/tg-wa-bridge/webhook" }
 */
export async function POST(request: Request) {
  if (!verifyBridgeAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = bridgeBotToken();
  if (!token) {
    return Response.json(
      { ok: false, error: "חסר TELEGRAM_BOT_TOKEN / TG_WA_TELEGRAM_BOT_TOKEN" },
      { status: 503 },
    );
  }

  let overrideUrl = "";
  try {
    const body = (await request.json()) as { url?: string };
    overrideUrl = (body.url || "").trim();
  } catch {
    // optional
  }

  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.WEBSITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const url =
    overrideUrl ||
    (site ? `${site.replace(/\/$/, "")}/api/tg-wa-bridge/webhook` : "");

  if (!url) {
    return Response.json(
      {
        ok: false,
        error: "חסר url — שלח ב-body או הגדר NEXT_PUBLIC_SITE_URL",
      },
      { status: 400 },
    );
  }

  const secret = webhookSecret();
  const response = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        allowed_updates: ["channel_post", "edited_channel_post"],
        drop_pending_updates: false,
        ...(secret ? { secret_token: secret } : {}),
      }),
      cache: "no-store",
    },
  );
  const body = await response.json().catch(() => null);

  return Response.json(
    {
      ok: Boolean((body as { ok?: boolean } | null)?.ok),
      url,
      telegram: body,
    },
    { status: response.ok ? 200 : 502 },
  );
}

export async function GET(request: Request) {
  if (!verifyBridgeAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = bridgeBotToken();
  if (!token) {
    return Response.json(
      { ok: false, error: "חסר TELEGRAM_BOT_TOKEN" },
      { status: 503 },
    );
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/getWebhookInfo`,
    { cache: "no-store" },
  );
  const body = await response.json().catch(() => null);
  return Response.json({ ok: true, telegram: body });
}
