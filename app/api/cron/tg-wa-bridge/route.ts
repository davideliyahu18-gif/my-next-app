import { verifyBridgeAuth } from "@/lib/tg-wa-bridge/auth";
import { runBridgePoll } from "@/lib/tg-wa-bridge/poll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Poll configured public Telegram channels and forward new posts to WhatsApp.
 * Auth: Bearer TG_WA_BRIDGE_SECRET / CRON_SECRET / FEED_API_SECRET
 */
export async function GET(request: Request) {
  if (!verifyBridgeAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry") === "1";
  const forceBootstrapSend = url.searchParams.get("force") === "1";
  const limitRaw = Number(url.searchParams.get("limit") || "20");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(50, Math.max(1, limitRaw))
    : 20;

  try {
    const summary = await runBridgePoll({
      dryRun,
      forceBootstrapSend,
      limit,
    });
    return Response.json(summary, {
      status: summary.configured || summary.ok ? 200 : 503,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Poll failed";
    console.error("[cron/tg-wa-bridge]", error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
