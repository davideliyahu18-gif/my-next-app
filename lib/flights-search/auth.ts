import { timingSafeEqual } from "node:crypto";

export function getFlightsBotSecret(): string {
  return process.env.FLIGHTS_BOT_SECRET ?? "";
}

export function isFlightsBotConfigured(): boolean {
  return Boolean(getFlightsBotSecret());
}

export function verifyFlightsBotAuth(request: Request): boolean {
  const secret = getFlightsBotSecret();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  const tokenHeader = request.headers.get("x-flights-bot-secret");
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
