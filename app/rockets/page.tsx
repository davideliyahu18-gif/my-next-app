import { Suspense } from "react";
import RocketTrackingMap from "@/components/rockets/RocketTrackingMap";

export default function RocketsPage() {
  return (
    <Suspense
      fallback={
        <div
          dir="rtl"
          className="flex min-h-screen items-center justify-center bg-[#eef1f5] text-sm text-slate-500"
        >
          טוען חמ״ל לייב…
        </div>
      }
    >
      <RocketTrackingMap />
    </Suspense>
  );
}
