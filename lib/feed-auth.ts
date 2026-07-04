import { timingSafeEqual } from "node:crypto";

export function getFeedApiSecret(): string {
  return process.env.FEED_API_SECRET ?? "";
}

export function verifyFeedAuth(request: Request): boolean {
  const secret = getFeedApiSecret();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  const tokenHeader = request.headers.get("x-feed-secret");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : (tokenHeader ?? "");

  if (!token) return false;

  try {
    const expected = Buffer.from(secret, "utf8");
    const received = Buffer.from(token, "utf8");
    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
