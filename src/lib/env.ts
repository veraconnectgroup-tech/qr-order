import "server-only";

import { publicEnv } from "@/lib/env/public";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env: ${key}`);
  return val;
}

/** Server-only env (API routes, Server Components, layouts). */
export const env = {
  ...publicEnv,
  supabaseServiceKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  cronSecret: process.env.CRON_SECRET,
} as const;
