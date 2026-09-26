import type { Metadata, Viewport } from "next";
import { SITE_SUBTITLE_HE, SITE_TITLE_HE } from "@/lib/iran-airspace/constants";
import "./iran-airspace.css";

export const metadata: Metadata = {
  title: SITE_TITLE_HE,
  description: SITE_SUBTITLE_HE,
  manifest: "/manifest-iran-airspace.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE_TITLE_HE,
  },
  icons: {
    icon: [
      { url: "/icon-iran-airspace-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-iran-airspace-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-iran-airspace-apple-touch.png", sizes: "180x180", type: "image/png" }],
  },
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
