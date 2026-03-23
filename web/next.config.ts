import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained build in .next/standalone — required for the production Docker image
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  experimental: {
    // Prevent the App Router client-side cache from serving stale pages on navigation/refresh
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },
  async headers() {
    return [
      {
        // HTML pages: never cache (data changes frequently)
        source: "/((?!_next/static|_next/image|favicon|vendors|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf)).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      {
        // Static JS/CSS chunks: immutable (Next.js includes content hash in filename)
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Vendored scripts (jspdf etc.)
        source: "/vendors/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
