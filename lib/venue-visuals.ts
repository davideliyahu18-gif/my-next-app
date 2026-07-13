import type { ScheduleMatchView } from "@/lib/types";
import { IMAGES } from "@/lib/constants";

export type MatchAtmosphere = {
  image: string;
  alt: string;
  venueLabel: string;
  city: string;
  accentFrom: string;
  accentTo: string;
};

const DEFAULT_ATMOSPHERE: MatchAtmosphere = {
  image: IMAGES.stadium,
  alt: "אצטדיון מואר בלילה",
  venueLabel: "מונדיאל 2026",
  city: "",
  accentFrom: "rgba(212,175,55,0.22)",
  accentTo: "transparent",
};

/** Stadium night imagery mapped to World Cup 2026 knockout venues. */
const VENUE_ATMOSPHERES: Array<{
  match?: RegExp;
  atmosphere: MatchAtmosphere;
}> = [
  {
    match: /dallas/i,
    atmosphere: {
      image:
        "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=2400&q=85",
      alt: "Dallas Stadium בלילה",
      venueLabel: "Dallas Stadium",
      city: "Dallas",
      accentFrom: "rgba(0,35,149,0.35)",
      accentTo: "rgba(198,11,30,0.2)",
    },
  },
  {
    match: /atlanta/i,
    atmosphere: {
      image:
        "https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=2400&q=85",
      alt: "Atlanta Stadium בלילה",
      venueLabel: "Atlanta Stadium",
      city: "Atlanta",
      accentFrom: "rgba(117,170,219,0.32)",
      accentTo: "rgba(200,16,46,0.18)",
    },
  },
  {
    match: /new york|new jersey|metlife|nj\b/i,
    atmosphere: {
      image:
        "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=2400&q=85",
      alt: "New York / New Jersey Stadium בלילה",
      venueLabel: "New York/New Jersey Stadium",
      city: "New Jersey",
      accentFrom: "rgba(212,175,55,0.28)",
      accentTo: "rgba(12,12,12,0.1)",
    },
  },
];

const TEAM_ACCENTS: Record<string, { from: string; to: string }> = {
  FRA: { from: "rgba(0,35,149,0.4)", to: "rgba(237,41,57,0.22)" },
  ESP: { from: "rgba(198,11,30,0.38)", to: "rgba(255,196,0,0.2)" },
  ENG: { from: "rgba(255,255,255,0.18)", to: "rgba(200,16,46,0.22)" },
  ARG: { from: "rgba(117,170,219,0.38)", to: "rgba(255,255,255,0.12)" },
};

export function resolveVenueAtmosphere(
  match: ScheduleMatchView | null | undefined,
  fallbackImage: string = IMAGES.stadium,
): MatchAtmosphere {
  if (!match) {
    return { ...DEFAULT_ATMOSPHERE, image: fallbackImage };
  }

  const venue = match.venue || "";
  const byVenue = VENUE_ATMOSPHERES.find((entry) => entry.match?.test(venue));
  const base = byVenue?.atmosphere ?? {
    ...DEFAULT_ATMOSPHERE,
    image: fallbackImage,
    venueLabel: venue || DEFAULT_ATMOSPHERE.venueLabel,
  };

  const homeAccent = TEAM_ACCENTS[match.homeCode?.toUpperCase() ?? ""];
  const awayAccent = TEAM_ACCENTS[match.awayCode?.toUpperCase() ?? ""];

  return {
    ...base,
    accentFrom: homeAccent?.from ?? base.accentFrom,
    accentTo: awayAccent?.to ?? awayAccent?.from ?? base.accentTo,
  };
}
