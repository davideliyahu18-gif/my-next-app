"use client";

import { useCallback, useEffect, useState } from "react";

const FAVORITES_KEY = "football-favorite-leagues-v1";

type PushStatus =
  | "loading"
  | "unsupported"
  | "denied"
  | "off"
  | "on"
  | "needs-config"
  | "ios-install";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export default function EnablePushNotifications() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState("");

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      if (isIos() && !isStandalone()) {
        setStatus("ios-install");
        setMessage("באייפון: הוסף למסך הבית ואז הפעל התראות");
      } else {
        setStatus("unsupported");
        setMessage("הדפדפן הזה לא תומך בהתראות פוש");
      }
      return;
    }

    try {
      const config = await fetch("/api/push/vapid", { cache: "no-store" }).then((r) =>
        r.json(),
      );
      if (!config.configured || !config.publicKey) {
        setStatus("needs-config");
        setMessage("צריך להגדיר מפתחות VAPID בשרת (Vercel)");
        return;
      }
      setPublicKey(config.publicKey);

      if (Notification.permission === "denied") {
        setStatus("denied");
        setMessage("התראות חסומות בהגדרות הדפדפן");
        return;
      }

      if (isIos() && !isStandalone()) {
        setStatus("ios-install");
        setMessage("באייפון: שתף → הוסף למסך הבית → ואז הפעל התראות");
        return;
      }

      const registration = await ensureServiceWorker();
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription && Notification.permission === "granted") {
        setStatus("on");
        setMessage("התראות פעילות במכשיר הזה");
      } else {
        setStatus("off");
        setMessage(null);
      }
    } catch {
      setStatus("unsupported");
      setMessage("לא ניתן לבדוק תמיכה בהתראות");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (!publicKey) {
        await refresh();
      }
      const key =
        publicKey ||
        (
          await fetch("/api/push/vapid", { cache: "no-store" }).then((r) => r.json())
        ).publicKey;
      if (!key) {
        setStatus("needs-config");
        setMessage("חסר מפתח VAPID בשרת");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        setMessage("לא אושרו התראות");
        return;
      }

      const registration = await ensureServiceWorker();
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
        });
      }

      let leagues: string[] = [];
      try {
        const raw = window.localStorage.getItem(FAVORITES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) leagues = parsed.map(String);
        }
      } catch {
        // ignore
      }

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          leagues,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Subscribe failed");
      }

      setStatus("on");
      setMessage("ההתראות הופעלו — אמורה להגיע התראת בדיקה עכשיו");
    } catch (error) {
      const text = error instanceof Error ? error.message : "שגיאה בהפעלה";
      setMessage(text);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("off");
      setMessage("ההתראות כובו במכשיר הזה");
    } catch {
      setMessage("לא הצלחנו לכבות את ההתראות");
    } finally {
      setBusy(false);
    }
  };

  const buttonLabel =
    status === "on"
      ? "כבה התראות"
      : status === "ios-install"
        ? "קודם הוסף למסך הבית"
        : status === "denied"
          ? "התראות חסומות"
          : status === "needs-config"
            ? "ממתין להגדרת שרת"
            : status === "unsupported"
              ? "לא נתמך"
              : busy
                ? "מפעיל..."
                : "הפעל התראות";

  const disabled =
    busy ||
    status === "loading" ||
    status === "unsupported" ||
    status === "denied" ||
    status === "needs-config" ||
    status === "ios-install";

  return (
    <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-sky-200">התראות פוש · שערי לייב</p>
          <p className="mt-1 text-xs text-zinc-400">
            קבל התראה במסך הנעילה כשנכבש גול בליגות שלך
          </p>
        </div>
        <button
          type="button"
          disabled={disabled && status !== "on"}
          onClick={() => {
            if (status === "on") void disable();
            else if (!disabled) void enable();
          }}
          className={`shrink-0 rounded-full px-5 py-2.5 text-xs font-black transition-transform ${
            status === "on"
              ? "border border-white/15 bg-white/5 text-zinc-200 hover:scale-[1.03]"
              : disabled
                ? "cursor-not-allowed bg-zinc-700 text-zinc-400"
                : "bg-sky-400 text-black hover:scale-[1.03]"
          }`}
        >
          {buttonLabel}
        </button>
      </div>
      {message && (
        <p className="mt-3 text-xs font-semibold text-sky-200/90">{message}</p>
      )}
    </div>
  );
}
