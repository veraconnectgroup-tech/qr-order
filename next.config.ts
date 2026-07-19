import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import { withSentryConfig } from "@sentry/nextjs";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  /** Staff routes register manually via PwaRegister — avoid SW on guest QR paths. */
  register: false,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  importScripts: ["/custom-sw.js"],
  fallbacks: {
    document: "/offline",
  },
  /** Guest QR menu must always hit network — never serve stale offline shell. */
  navigateFallbackDenylist: [
    /^\/(?!admin|dashboard|enterprise|invite|login|offline|platform|signup|waiter|w(?:\/|$))[^/]+\/[^/]+/,
  ],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/(products|categories)(\/|\?).*/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "menu-data",
        expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern:
        /^https:\/\/.*\.supabase\.co\/rest\/v1\/(orders|order_items|waiter_calls)(\/|\?).*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "orders-data",
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 100, maxAgeSeconds: 300 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /\/dashboard\/(kitchen|orders|waiter-calls)/,
      handler: "NetworkFirst",
      options: {
        cacheName: "dashboard-pages",
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 10, maxAgeSeconds: 300 },
      },
    },
    {
      urlPattern: /\/api\/orders(\/|\?|$)/i,
      handler: "NetworkOnly",
      method: "POST",
      options: {
        cacheName: "order-submit",
      },
    },
    {
      urlPattern: /^\/api\//,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: { maxEntries: 50, maxAgeSeconds: 300 },
      },
    },
    {
      urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "image-cache",
        expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: "NetworkOnly",
      options: {
        cacheName: "next-static",
      },
    },
  ],
});

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // CI runs `pnpm type-check` + `pnpm lint` before deploy; on Vercel's 2-core/8GB
  // box TypeScript after webpack+PWA+Sentry can thrash until the 45min build limit.
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts"],
    /** Lower peak RSS during webpack on Vercel 2-core/8GB builders. */
    webpackMemoryOptimizations: true,
    /** Single-threaded compilation — parallel workers multiply peak RSS and were SIGKILLing the build. */
    cpus: 1,
    workerThreads: false,
  },
  productionBrowserSourceMaps: false,
  images: {
    minimumCacheTTL: 2592000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async rewrites() {
    return [
      { source: "/icon-192.png", destination: "/icon-192" },
      { source: "/icon-512.png", destination: "/icon-512" },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      // Immutable long-cache on static chunks is correct in production (filenames
      // are content-hashed per build), but in dev it makes browsers permanently
      // cache stale JS across restarts/reloads — Next.js itself warns about this.
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              source: "/_next/static/:path*",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
          ]
        : []),
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

const configWithPwa = withPWA(nextConfig);

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(configWithPwa, {
      silent: true,
      // widenClientFileUpload spikes memory during webpack — CI/Vercel already OOM-prone.
      widenClientFileUpload: false,
      // Sourcemap generation/upload was still SIGKILLing the 2-core/8GB Vercel
      // builder even with widenClientFileUpload off and single-threaded webpack
      // (cpus: 1 above) — disable unconditionally. Trades readable Sentry
      // stack traces for a build that actually finishes; revisit if the
      // Vercel build machine tier is upgraded.
      sourcemaps: {
        disable: true,
      },
    })
  : configWithPwa;
