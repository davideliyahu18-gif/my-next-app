"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      dir="rtl"
      className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center text-white"
    >
      <h1 className="text-2xl font-black text-[#d4af37]">מונדיאל 2026</h1>
      <p className="mt-4 max-w-md text-sm text-zinc-400">
        משהו השתבש בטעינת הנתונים. האתר יחזור לעבוד בעוד רגע.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-[#d4af37] px-6 py-2.5 text-sm font-bold text-black"
        >
          נסה שוב
        </button>
        <Link
          href="/"
          className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium text-zinc-300"
        >
          דף הבית
        </Link>
      </div>
    </div>
  );
}
