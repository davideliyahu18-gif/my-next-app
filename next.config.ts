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
  {
    protocol: "https",
    hostname: "imagecache.365scores.com",
    pathname: "/**",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/flights",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/api/flights/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
