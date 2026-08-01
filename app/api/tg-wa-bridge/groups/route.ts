import { verifyBridgeAuth } from "@/lib/tg-wa-bridge/auth";
import { bridgeWhatsAppGroupName } from "@/lib/tg-wa-bridge/channels";
import {
  findPreferredGroup,
  listWhatsAppGroups,
} from "@/lib/tg-wa-bridge/groups";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * List WhatsApp groups from Green API and highlight the configured one.
 * Auth: Bearer TG_WA_BRIDGE_SECRET / CRON_SECRET / FEED_API_SECRET
 */
export async function GET(request: Request) {
  if (!verifyBridgeAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preferredName = bridgeWhatsAppGroupName();
  const result = await listWhatsAppGroups();
  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        preferredName,
        error: result.error,
        tip: "הגדר GREEN_API_INSTANCE + GREEN_API_TOKEN ואז קרא שוב",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || preferredName).trim();
  const preferred = findPreferredGroup(result.groups, preferredName);
  const filtered = q
    ? result.groups.filter(
        (g) =>
          g.name.includes(q.replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim()) ||
          g.name.includes("דיווחים") ||
          g.name.includes("איראן") ||
          g.id.includes(q),
      )
    : result.groups;

  return Response.json({
    ok: true,
    preferredName,
    preferredGroup: preferred,
    count: filtered.length,
    groups: filtered.length ? filtered : result.groups,
    tip: preferred
      ? `שים ב-Vercel: TG_WA_WHATSAPP_CHAT_ID=${preferred.id}`
      : "לא נמצאה הקבוצה — ודא שהמספר של Green API חבר ב«דיווחים מבצעי איראן»",
  });
}
