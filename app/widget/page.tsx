import HomeScreenWidget from "@/components/HomeScreenWidget";
import { getTodaysMatches } from "@/lib/api";
import { SITE_BRAND } from "@/lib/constants";
import type { Metadata } from "next";

export const revalidate = 30;

export const metadata: Metadata = {
  title: `ווידג׳ט חי · ${SITE_BRAND.name}`,
  description: "משחקי היום ותוצאות חיות במסך קומפקטי למסך הבית",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "בזמן אמת",
  },
};

export default async function WidgetPage() {
  const todays = await getTodaysMatches();
  return <HomeScreenWidget initial={todays} />;
}
