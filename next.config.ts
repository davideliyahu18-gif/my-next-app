import type { NextConfig } from "next";
import path from "path";

/**
 * External image hosts used by the FIFA live bridge and static assets.
 * Do not set `search: ""` — that blocks query strings (ui-avatars uses them).
 */
const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  {
    protocol: "https",
    hostname: "images.unsplash.com",
    pathname: "/**",
  },
  {
    protocol: "https",
    hostname: "plus.unsplash.com",
    pathname: "/**",
  },
  {
    protocol: "https",
    hostname: "ui-avatars.com",
    pathname: "/api/**",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns,
  },
};

export default nextConfig;
