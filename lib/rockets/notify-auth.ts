import { timingSafeEqual } from "node:crypto";

/** Accept FEED_API_SECRET, CRON_SECRET, or TELEGRAM_NOTIFY_SECRET. */
export function verifyRocketNotifyAuth(request: Request): boolean {
  const secrets = [
    process.env.TELEGRAM_NOTIFY_SECRET,
    process.env.CRON_SECRET,
    process.env.FEED_API_SECRET,
    process.env.MISSILE_ALERT_SECRET,
  ].filter((value): value is string => Boolean(value && value.length > 0));

  if (secrets.length === 0) return false;

  const authHeader = request.headers.get("authorization");
  const tokenHeader = request.headers.get("x-notify-secret");
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
