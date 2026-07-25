import { timingSafeEqual } from "node:crypto";

export function getCronSecret(): string {
  return process.env.CRON_SECRET ?? "";
}

export function verifyCronAuth(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : (request.headers.get("x-cron-secret") ?? "");

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
