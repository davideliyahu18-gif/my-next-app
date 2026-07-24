/** Verify Vercel cron / manual poll Authorization header. */
export function verifyFifaBotCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.FIFA_BOT_SECRET ?? "";
  if (!secret) {
    // Allow local/dev without secret; block in production.
    return process.env.NODE_ENV !== "production";
  }

  const header = request.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  return querySecret === secret;
}

export function verifyFifaBotCommandAuth(request: Request): boolean {
  const secret =
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
