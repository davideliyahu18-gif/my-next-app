/**
 * Web Push (VAPID) configuration.
 * Set on Vercel:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT=mailto:you@example.com
 */

export function getVapidPublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.VAPID_PUBLIC_KEY ||
    ""
  ).trim();
}

export function getVapidPrivateKey(): string {
  return (process.env.VAPID_PRIVATE_KEY || "").trim();
}

export function getVapidSubject(): string {
  return (
    process.env.VAPID_SUBJECT ||
    process.env.WEBSITE_URL ||
    "mailto:alerts@example.com"
  ).trim();
}

export function isPushConfigured(): boolean {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}
