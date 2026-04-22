import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000/api/v1";
const apiOrigin = (() => {
  try {
    const parsed = new URL(apiInternalUrl);
    return parsed.origin;
  } catch {
    return "http://localhost:8000";
  }
})();
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${apiOrigin} https:`,
].join("; ");

const nextConfig: NextConfig = {
  // Produces a self-contained build in .next/standalone — required for the production Docker image
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    // Prevent the App Router client-side cache from serving stale pages on navigation/refresh
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  async headers() {
    if (!isProduction) {
      return [];
    }

    return [
      {
        // HTML pages: never cache (data changes frequently)
        source: "/((?!_next/static|_next/image|favicon|vendors|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf)).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
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
        destination: `${apiInternalUrl}/:path*`,
      },
      {
        source: "/sanctum/csrf-cookie",
        destination: `${apiOrigin}/sanctum/csrf-cookie`,
      },
    ];
  },
};

export default nextConfig;
