"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallHomeWidget() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [tip, setTip] = useState<string | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const installApp = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      setTip(
        choice.outcome === "accepted"
          ? "האפליקציה נוספה · לחצו לחיצה ארוכה לאייקון לפתיחת ווידג׳ט חי"
          : "אפשר גם להוסיף ידנית מהתפריט",
      );
      return;
    }

    setTip(
      isIos
        ? "באייפון: פתחו /widget ← שתף ← הוסף למסך הבית"
        : "באנדרואיד/כרום: תפריט ⋮ → התקן אפליקציה / הוסף למסך הבית",
    );
  };

  return (
    <div className="rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/10 via-black/20 to-emerald-500/10 p-4">
      <p className="text-sm font-black text-white">ווידג׳ט מסך הבית</p>
      <p className="mt-1 text-xs text-zinc-400">
        מסך קומפקטי עם משחקי היום ותוצאות חיות — נשמר כמו אפליקציה קטנה
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/widget"
          className="rounded-full bg-gold px-4 py-2 text-xs font-black text-black transition-transform hover:scale-[1.03]"
        >
          פתח ווידג׳ט חי
        </Link>
        <button
          type="button"
          onClick={() => {
            void installApp();
          }}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-zinc-200 hover:border-gold/40 hover:text-gold"
        >
          הוסף למסך הבית
        </button>
      </div>
      {tip ? (
        <p className="mt-3 text-xs font-semibold text-emerald-300/90">{tip}</p>
      ) : null}
    </div>
  );
}
