import type { BrowserOptions, EdgeOptions, NodeOptions } from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function getSentryOptions():
  | BrowserOptions
  | NodeOptions
  | EdgeOptions {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment:
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV ??
      "development",
    release:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
    ],
  };
}
