/**
 * Server-side Supabase REST URL for @supabase/supabase-js.
 *
 * Prefer SUPABASE_DB_POOL_URL when it is an HTTPS API URL. The Postgres pooler
 * string from Dashboard → Database → Connection Pooling (Transaction mode,
 * postgres://…pooler.supabase.com:6543) is for direct SQL only — migrations,
 * pg_dump, Prisma/Drizzle — not for createClient().
 *
 * The JS client talks to PostgREST over HTTPS; Supabase pools DB connections
 * on the platform side, which suits serverless/edge runtimes.
 */
export function getSupabaseServerUrl(): string {
  const poolUrl = process.env.SUPABASE_DB_POOL_URL?.trim();
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (
    poolUrl &&
    (poolUrl.startsWith("https://") || poolUrl.startsWith("http://"))
  ) {
    return poolUrl;
  }

  if (apiUrl) {
    return apiUrl;
  }

  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is required. SUPABASE_DB_POOL_URL (postgres pooler) is for direct SQL/migrations only."
  );
}

/** Postgres pooler URL (Transaction mode) — direct connections & migrations only. */
export function getSupabaseDbPoolUrl(): string | undefined {
  return process.env.SUPABASE_DB_POOL_URL?.trim() || undefined;
}
