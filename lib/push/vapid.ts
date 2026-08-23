/**
 * Web Push (VAPID) configuration.
 *
 * Prefer env vars on Vercel when available:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT=mailto:you@example.com
 *
 * Fallback keys keep personal/hobby deploys working without dashboard access.
 * Rotate later and move private key to server env only.
 */

const DEFAULT_VAPID_PUBLIC_KEY =
  "BKqP_teQw9jTa84jRTAmqTon4s53H2goZ75m2LOkZqrTzpOwmZ6Rga9Hu74_B9x7FZMn8PRfLZpffEQA7r9-UAg";

const DEFAULT_VAPID_PRIVATE_KEY = "Ib780a2aaU2pTqaBRqADHq-KyzoRCbQXz-gCSftdpUI";

export function getVapidPublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.VAPID_PUBLIC_KEY ||
    DEFAULT_VAPID_PUBLIC_KEY
  ).trim();
}

export function getVapidPrivateKey(): string {
  return (process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY).trim();
}

export function getVapidSubject(): string {
  return (
    process.env.VAPID_SUBJECT ||
    process.env.WEBSITE_URL ||
    "mailto:davideliyahu18@gmail.com"
  ).trim();
}

export function isPushConfigured(): boolean {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}
