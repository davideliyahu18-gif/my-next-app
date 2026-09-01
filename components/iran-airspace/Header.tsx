"use client";

import { useState } from "react";
import Modal from "./Modal";
import { SITE_SUBTITLE_HE, SITE_TITLE_HE } from "@/lib/iran-airspace/constants";
import type { ConnectionState } from "@/lib/iran-airspace/types";

function formatClock(iso: string | null): string {
  if (!iso) return "--:--:--";
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

const DOT_COLOR: Record<ConnectionState, string> = {
  connected: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]",
  degraded: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]",
  down: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]",
};

const LABEL: Record<ConnectionState, string> = {
  connected: "LIVE",
  degraded: "LIVE (איטי)",
  down: "לא זמין",
};

export type MapLayerId = "dark" | "satellite";

function IconButton({
  label,
  onClick,
  children,
  badge,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-white/10 hover:text-slate-100"
    >
      {children}
      {Boolean(badge) && (
        <span className="absolute -top-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function Header({
  connection,
  lastUpdate,
  alerts,
  onViewAllAlerts,
  layerId,
  onLayerChange,
}: {
  connection: ConnectionState;
  lastUpdate: string | null;
  alerts: { id: string; text: string; time: string }[];
  onViewAllAlerts: () => void;
  layerId: MapLayerId;
  onLayerChange: (id: MapLayerId) => void;
}) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="relative z-20 flex items-center justify-between gap-2 border-b border-sky-400/10 bg-[#050b14]/95 px-3 py-2.5 backdrop-blur-xl sm:gap-3 sm:px-5 sm:py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none sm:gap-2.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_COLOR[connection]} ${connection === "connected" ? "animate-pulse" : ""}`} />
        <span className="text-xs font-bold tracking-widest text-slate-200 sm:text-sm">
          {LABEL[connection]}
        </span>
      </div>

      <div className="min-w-0 flex-1 text-center sm:flex-none">
        <h1 className="truncate text-[15px] font-extrabold tracking-tight text-slate-50 sm:text-2xl">
          <span aria-hidden>🇮🇷</span> {SITE_TITLE_HE}
        </h1>
        <p className="mt-0.5 hidden text-[11px] text-slate-400 sm:block sm:text-xs">
          {SITE_SUBTITLE_HE}
        </p>
      </div>

      <div className="flex flex-1 items-center justify-end gap-0.5 sm:flex-none sm:gap-1">
        <span className="hidden rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-slate-400 sm:mx-1 sm:block sm:text-xs">
          עדכון אחרון: {formatClock(lastUpdate)}
        </span>

        <div className="relative">
          <IconButton label="התראות" badge={alerts.length} onClick={() => setAlertsOpen((v) => !v)}>
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconButton>
          {alertsOpen && (
            <>
              <div className="iran-airspace-clickcatch" onClick={() => setAlertsOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border border-white/10 bg-[#0a1220]/95 shadow-2xl backdrop-blur-xl">
                <div className="border-b border-white/5 px-3 py-2 text-xs font-bold text-slate-300">
                  התראות פעילות
                </div>
                <div className="max-h-64 overflow-y-auto p-1.5">
                  {alerts.length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-slate-500">אין התראות חדשות</p>
                  ) : (
                    alerts.slice(0, 6).map((a) => (
                      <div key={a.id} className="rounded-md px-2 py-1.5 text-xs text-slate-300">
                        <span className="text-slate-500">{a.time}</span> · {a.text}
                      </div>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAlertsOpen(false);
                    onViewAllAlerts();
                  }}
                  className="block w-full border-t border-white/5 px-3 py-2 text-center text-xs font-bold text-sky-300 hover:bg-white/5"
                >
                  הצג את כל ההתראות
                </button>
              </div>
            </>
          )}
        </div>

        <IconButton label="אודות" onClick={() => setAboutOpen(true)}>
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 16v-5M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>

        <IconButton label="הגדרות" onClick={() => setSettingsOpen(true)}>
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
      </div>

      <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} title="אודות המערכת">
        <p>
          {SITE_TITLE_HE} מציגה תנועות תעופה ציבוריות באזור איראן והמדינות השכנות, על בסיס נתוני
          ADS-B המשודרים בשידור פתוח על ידי כלי טיס ונאספים על ידי רשתות חובבים ציבוריות
          (adsb.fi, ועם נפילה אוטומטית ל-adsb.lol).
        </p>
        <p className="mt-2">
          סיווג המטוסים (אזרחי / צבאי / תדלוק / מודיעין-מעקב) מבוסס אך ורק על מידע ציבורי — דגל
          &quot;כלי טיס צבאי&quot; המשודר במקור הנתונים ותיאור סוג כלי הטיס. המערכת אינה מבצעת הערכת
          איומים, אינה מנתחת כוונות ואינה מציגה תחזיות לפעילות צבאית — היא מציגה אך ורק את מיקומי
          כלי הטיס כפי שהם משודרים בפועל.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          נתוני ADS-B ציבוריים עשויים להיות חלקיים, מושהים או לא זמינים באזורים עם כיסוי מקלטים
          דליל — במיוחד מעל שטחי יבשה מרוחקים ממקלטים.
        </p>
      </Modal>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="הגדרות">
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-xs font-bold text-slate-400">שכבת מפה</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onLayerChange("dark")}
                className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-semibold ${
                  layerId === "dark" ? "border-sky-400/40 bg-sky-500/10 text-sky-300" : "border-white/10 text-slate-400"
                }`}
              >
                כהה
              </button>
              <button
                type="button"
                onClick={() => onLayerChange("satellite")}
                className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-semibold ${
                  layerId === "satellite" ? "border-sky-400/40 bg-sky-500/10 text-sky-300" : "border-white/10 text-slate-400"
                }`}
              >
                לוויין
              </button>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            רענון נתונים אוטומטי כל 10 שניות ממקורות ADS-B ציבוריים.
          </div>
        </div>
      </Modal>
    </header>
  );
}
