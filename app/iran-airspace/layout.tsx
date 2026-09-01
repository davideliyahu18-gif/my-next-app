import type { Metadata, Viewport } from "next";
import { SITE_SUBTITLE_HE, SITE_TITLE_HE } from "@/lib/iran-airspace/constants";
import "./iran-airspace.css";

export const metadata: Metadata = {
  title: SITE_TITLE_HE,
  description: SITE_SUBTITLE_HE,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050b14",
};

export default function IranAirspaceLayout({ children }: { children: React.ReactNode }) {
  return <div className="iran-airspace-root">{children}</div>;
}
