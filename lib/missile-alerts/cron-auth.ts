/** Verify Vercel cron / manual poll Authorization header. */
export function verifyMissileAlertCronAuth(request: Request): boolean {
  const secret =
    process.env.CRON_SECRET ??
    process.env.MISSILE_ALERT_SECRET ??
    process.env.FEED_API_SECRET ??
    "";
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const header = request.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  return querySecret === secret;
}
