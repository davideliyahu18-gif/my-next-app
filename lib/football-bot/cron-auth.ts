/** Verify Vercel cron / manual poll Authorization header. */
export function verifyFootballBotCronAuth(request: Request): boolean {
  const secret =
    process.env.CRON_SECRET ??
    process.env.FOOTBALL_BOT_SECRET ??
    process.env.FIFA_BOT_SECRET ??
    "";
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const header = request.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export function verifyFootballBotCommandAuth(request: Request): boolean {
  const secret =
    process.env.FOOTBALL_BOT_SECRET ??
    process.env.FIFA_BOT_SECRET ??
    process.env.FEED_API_SECRET ??
    process.env.CRON_SECRET ??
    "";
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}
