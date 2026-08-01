import { timingSafeEqual } from "node:crypto";

/** Accept bridge / cron / feed secrets. */
export function verifyBridgeAuth(request: Request): boolean {
  const secrets = [
    process.env.TG_WA_BRIDGE_SECRET,
    process.env.CRON_SECRET,
    process.env.FEED_API_SECRET,
    process.env.TELEGRAM_NOTIFY_SECRET,
    process.env.MISSILE_ALERT_SECRET,
  ].filter((value): value is string => Boolean(value && value.length > 0));

  if (secrets.length === 0) return false;

  const authHeader = request.headers.get("authorization");
  const tokenHeader = request.headers.get("x-bridge-secret");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : (tokenHeader ?? "");

  if (!token) return false;

  const received = Buffer.from(token, "utf8");
  for (const secret of secrets) {
    const expected = Buffer.from(secret, "utf8");
    if (
      expected.length === received.length &&
      timingSafeEqual(expected, received)
    ) {
      return true;
    }
  }
  return false;
}

export function verifyTelegramWebhookSecret(request: Request): boolean {
  const expected = (
    process.env.TG_WA_WEBHOOK_SECRET ||
    process.env.TELEGRAM_WEBHOOK_SECRET ||
    process.env.TG_WA_BRIDGE_SECRET ||
    process.env.FEED_API_SECRET ||
    ""
  ).trim();
  if (!expected) return true;

  const received = (
    request.headers.get("x-telegram-bot-api-secret-token") || ""
  ).trim();
  if (!received) return false;

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
