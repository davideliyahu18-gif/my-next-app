"use client";

import { useCallback, useEffect, useState } from "react";
import { FLIGHTS_TRACKED_STORAGE_KEY } from "@/lib/flights/constants";
import type { FlightRecord } from "@/lib/flights/types";

function readStoredCodes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FLIGHTS_TRACKED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item || "").trim().toUpperCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeStoredCodes(codes: string[]) {
  window.localStorage.setItem(
    FLIGHTS_TRACKED_STORAGE_KEY,
    JSON.stringify(codes),
  );
}

export function useTrackedFlights() {
  const [trackedCodes, setTrackedCodes] = useState<string[]>([]);
  const [trackedFlights, setTrackedFlights] = useState<FlightRecord[]>([]);

  useEffect(() => {
    setTrackedCodes(readStoredCodes());
  }, []);

  const refreshTracked = useCallback(async (codes = trackedCodes) => {
    if (!codes.length) {
      setTrackedFlights([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/flights/track?codes=${encodeURIComponent(codes.join(","))}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const payload = (await response.json()) as { flights?: FlightRecord[] };
      setTrackedFlights(payload.flights ?? []);
    } catch {
      // Keep previous tracked snapshot on transient errors.
    }
  }, [trackedCodes]);

  useEffect(() => {
    void refreshTracked(trackedCodes);
  }, [trackedCodes, refreshTracked]);

  const isTracked = useCallback(
    (flightCode: string) =>
      trackedCodes.includes(flightCode.trim().toUpperCase()),
    [trackedCodes],
  );

  const toggleTrack = useCallback((flightCode: string) => {
    const code = flightCode.trim().toUpperCase();
    setTrackedCodes((current) => {
      const next = current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code];
      writeStoredCodes(next);
      return next;
    });
  }, []);

  return {
    trackedCodes,
    trackedFlights,
    isTracked,
    toggleTrack,
    refreshTracked,
  };
}
