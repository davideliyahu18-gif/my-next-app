import { NextResponse } from "next/server";
import { verifyMissileAlertCronAuth } from "@/lib/missile-alerts/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type GreenChat = {
  id?: string;
  name?: string;
  type?: string;
};

/**
 * Lists WhatsApp chats from Green API so you can copy the group @g.us id.
 * Auth: Bearer CRON_SECRET / MISSILE_ALERT_SECRET / FEED_API_SECRET
 */
export async function GET(request: Request) {
  if (!verifyMissileAlertCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const instance = process.env.GREEN_API_INSTANCE ?? "";
  const token = process.env.GREEN_API_TOKEN ?? "";
  if (!instance || !token) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Set GREEN_API_INSTANCE and GREEN_API_TOKEN, then call this again",
        hint: "See scripts/missile-whatsapp/GREEN-API-SETUP.md",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(
      `https://api.green-api.com/waInstance${instance}/getChats/${token}`,
      { cache: "no-store" },
    );
    const body = (await response.json().catch(() => null)) as
      | GreenChat[]
      | { message?: string }
      | null;

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Green API getChats failed",
          status: response.status,
          body,
        },
        { status: 502 },
      );
    }

    const chats = Array.isArray(body) ? body : [];
    const groups = chats
      .filter((chat) => String(chat.id ?? "").endsWith("@g.us"))
      .map((chat) => ({
        id: String(chat.id),
        name: String(chat.name ?? ""),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "he"));

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "מרכז התרעות").trim().toLowerCase();
    const filtered = q
      ? groups.filter(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            g.id.toLowerCase().includes(q) ||
            g.name.includes("מרכז התרעות"),
        )
      : groups;

    const preferredName = "🛡️ מרכז התרעות אזורי";
    const preferred =
      groups.find((g) => g.name === preferredName) ??
      groups.find((g) => g.name.includes("מרכז התרעות")) ??
      null;

    return NextResponse.json({
      ok: true,
      preferredGroup: preferred,
      count: filtered.length,
      groups: filtered,
      tip: preferred
        ? `Set MISSILE_WHATSAPP_CHAT_ID=${preferred.id}`
        : "Copy the id ending with @g.us into MISSILE_WHATSAPP_CHAT_ID",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
