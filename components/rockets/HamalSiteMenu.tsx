"use client";

import { useEffect, useMemo, useState } from "react";
import { ALERT_AREAS, formatShelterSeconds } from "@/lib/rockets/alert-areas";
import { MENU_AREA_IDS } from "@/lib/rockets/bot-menu";
import type { ActiveAlertArea } from "@/lib/rockets/types";

const STORAGE_KEY = "hamal-site-menu-v1";

type MenuPanel = "home" | "areas" | "shelter" | "status" | "safe";

type StoredPrefs = {
  areas: string[];
  muted: boolean;
  safeAt?: string;
};

type Props = {
  activeAreas: ActiveAlertArea[];
  relatedCount: number;
  trackCount: number;
  updatedAt: string | null;
  focusAreaId: string | null;
  onFocusArea: (areaId: string | null) => void;
  onScrollToMap: () => void;
  autoAlerts: boolean;
  onAutoAlertsChange: (value: boolean) => void;
};

function loadPrefs(): StoredPrefs {
  if (typeof window === "undefined") {
    return { areas: [], muted: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { areas: [], muted: false };
    const parsed = JSON.parse(raw) as Partial<StoredPrefs>;
    return {
      areas: Array.isArray(parsed.areas) ? parsed.areas.map(String) : [],
      muted: Boolean(parsed.muted),
      safeAt: typeof parsed.safeAt === "string" ? parsed.safeAt : undefined,
    };
  } catch {
    return { areas: [], muted: false };
  }
}

function savePrefs(prefs: StoredPrefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode
  }
}

const MENU_AREAS = MENU_AREA_IDS.map(
  (id) => ALERT_AREAS.find((a) => a.id === id)!,
).filter(Boolean);

export default function HamalSiteMenu({
  activeAreas,
  relatedCount,
  trackCount,
  updatedAt,
  focusAreaId,
  onFocusArea,
  onScrollToMap,
  autoAlerts,
  onAutoAlertsChange,
}: Props) {
  const [panel, setPanel] = useState<MenuPanel>("home");
  const [prefs, setPrefs] = useState<StoredPrefs>(() =>
    typeof window === "undefined" ? { areas: [], muted: false } : loadPrefs(),
  );

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const myAreas = useMemo(() => {
    if (prefs.areas.length === 0) return MENU_AREAS.slice(0, 5);
    return MENU_AREAS.filter((a) => prefs.areas.includes(a.id));
  }, [prefs.areas]);

  const relevantActive = useMemo(() => {
    if (prefs.areas.length === 0) return activeAreas;
    return activeAreas.filter(
      (a) => prefs.areas.includes(a.id) || a.id === "israel",
    );
  }, [activeAreas, prefs.areas]);

  function toggleArea(areaId: string) {
    setPrefs((prev) => {
      const has = prev.areas.includes(areaId);
      return {
        ...prev,
        areas: has
          ? prev.areas.filter((id) => id !== areaId)
          : [...prev.areas, areaId],
      };
    });
  }

  function markSafe() {
    const safeAt = new Date().toISOString();
    setPrefs((prev) => ({ ...prev, safeAt }));
    setPanel("safe");
  }

  function toggleMute() {
    setPrefs((prev) => {
      const muted = !prev.muted;
      onAutoAlertsChange(!muted && autoAlerts ? autoAlerts : !muted);
      return { ...prev, muted };
    });
  }

  const stamp = updatedAt
    ? new Intl.DateTimeFormat("he-IL", {
        timeZone: "Asia/Jerusalem",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(updatedAt))
    : "—";

  return (
    <section
      id="hamal-menu"
      className="rounded-3xl border-2 border-blue-500 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
    >
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-base font-black text-blue-700">תפריט חמ״ל</h2>
          <p className="text-[11px] text-slate-500">
            {prefs.muted
              ? "התראות מושתקות"
              : prefs.areas.length === 0
                ? "מקבלים הכל · בחרו ערים לסינון"
                : `${prefs.areas.length} אזורים נבחרו`}
          </p>
        </div>
        {panel !== "home" ? (
          <button
            type="button"
            onClick={() => setPanel("home")}
            className="text-[11px] font-bold text-blue-600"
          >
            ← תפריט
          </button>
        ) : null}
      </div>

      {panel === "home" ? (
        <div className="grid grid-cols-2 gap-2">
          <MenuTile
            icon="🛡️"
            label="התראות שלי"
            hint="בחירת ערים"
            onClick={() => setPanel("areas")}
          />
          <MenuTile
            icon="🗺️"
            label="מפה חיה"
            hint="גלול למפה"
            onClick={() => {
              onScrollToMap();
              setPanel("home");
            }}
          />
          <MenuTile
            icon="⏱️"
            label="זמן למרחב מוגן"
            hint="לפי העיר שלך"
            onClick={() => setPanel("shelter")}
          />
          <MenuTile
            icon="📊"
            label="מצב עכשיו"
            hint="סיכום חי"
            onClick={() => setPanel("status")}
          />
          <MenuTile
            icon="✅"
            label="אני בטוח"
            hint="צ׳ק־אין"
            onClick={markSafe}
          />
          <MenuTile
            icon={prefs.muted ? "🔔" : "🔕"}
            label={prefs.muted ? "הפעל התראות" : "השתק"}
            hint={prefs.muted ? "כרגע שקט" : "כבה התראות מסך"}
            onClick={toggleMute}
          />
        </div>
      ) : null}

      {panel === "areas" ? (
        <div>
          <p className="mb-2 px-1 text-[11px] text-slate-500">
            לחצו על ערים לסינון. ריק = הכל.
          </p>
          <div className="flex flex-wrap gap-2">
            {MENU_AREAS.map((area) => {
              const on = prefs.areas.includes(area.id);
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => toggleArea(area.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    on
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {area.labelHe}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setPrefs((p) => ({ ...p, areas: [] }))}
            className="mt-3 text-[11px] font-semibold text-slate-500"
          >
            נקה בחירה · קבל הכל
          </button>
        </div>
      ) : null}

      {panel === "shelter" ? (
        <ul className="space-y-2">
          {myAreas.map((area) => (
            <li key={area.id}>
              <button
                type="button"
                onClick={() => {
                  onFocusArea(area.id);
                  onScrollToMap();
                }}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-right ${
                  focusAreaId === area.id
                    ? "bg-red-50 ring-1 ring-red-300"
                    : "bg-orange-50/80"
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {area.labelHe}
                  </p>
                  <p className="text-[11px] text-slate-500">{area.regionHe}</p>
                </div>
                <div className="text-left">
                  <p className="font-mono text-lg font-black text-orange-700">
                    {area.shelterSeconds}
                    <span className="mr-0.5 text-xs">שנ׳</span>
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {formatShelterSeconds(area.shelterSeconds)}
                  </p>
                </div>
              </button>
            </li>
          ))}
          <p className="px-1 text-[10px] text-slate-400">
            הערכת ייחוס — לא מחליפה פיקוד העורף.
          </p>
        </ul>
      ) : null}

      {panel === "status" ? (
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="text-sm font-black text-slate-900">מצב עכשיו</p>
          <p className="mt-1 text-xs text-slate-600">
            שיגורים במעקב: {relatedCount} · מסלולים: {trackCount}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">עודכן: {stamp}</p>
          <div className="mt-3 space-y-1.5">
            {relevantActive.length === 0 ? (
              <p className="text-xs text-slate-500">אין אזור פעיל כרגע.</p>
            ) : (
              relevantActive.slice(0, 6).map((area) => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => {
                    onFocusArea(area.id);
                    onScrollToMap();
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-right text-xs"
                >
                  <span className="font-bold text-slate-800">{area.labelHe}</span>
                  <span className="font-mono font-bold text-orange-700">
                    {formatShelterSeconds(area.shelterSeconds)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {panel === "safe" ? (
        <div className="rounded-2xl bg-emerald-50 px-4 py-5 text-center">
          <p className="text-3xl">✅</p>
          <p className="mt-2 text-sm font-black text-emerald-900">אני בטוח</p>
          <p className="mt-1 text-xs text-emerald-800">
            {prefs.safeAt
              ? `נרשם: ${new Intl.DateTimeFormat("he-IL", {
                  timeZone: "Asia/Jerusalem",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }).format(new Date(prefs.safeAt))}`
              : "נשמר במכשיר"}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function MenuTile({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: string;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl bg-[#f3f6fa] px-3 py-3 text-right transition hover:bg-[#e8eef6] active:scale-[0.98]"
    >
      <div className="text-xl">{icon}</div>
      <p className="mt-1 text-sm font-black text-slate-900">{label}</p>
      <p className="text-[10px] text-slate-500">{hint}</p>
    </button>
  );
}
