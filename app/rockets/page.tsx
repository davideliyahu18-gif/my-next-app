import { Suspense } from "react";
import RocketTrackingMap from "@/components/rockets/RocketTrackingMap";

export default function RocketsPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-transparent">
      {/* Server-rendered so the menu is visible even before JS loads */}
      <div className="border-b border-blue-800 bg-[#1e4fd6] px-3 py-2 text-center text-white">
        <p className="text-sm font-black tracking-tight">
          חמ״ל לייב · תפריט למטה ↓
        </p>
        <p className="text-[11px] text-white/85">
          התראות שלי · מפה · זמן למרחב מוגן · מצב עכשיו · אני בטוח
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
            טוען תפריט חמ״ל…
          </div>
        }
      >
        <RocketTrackingMap />
      </Suspense>
    </div>
  );
}
