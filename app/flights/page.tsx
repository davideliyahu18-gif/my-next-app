import type { Metadata } from "next";
import { FlightsDashboard } from "@/components/flights/FlightsDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "נתב״ג חי · נחיתות והמראות",
  description:
    "לוח טיסות חי לנתב״ג — נחיתות, המראות, עיכובים וסטטוסים. מקור רשמי: רשות שדות התעופה ב-data.gov.il",
};

export default function FlightsPage() {
  return <FlightsDashboard />;
}
