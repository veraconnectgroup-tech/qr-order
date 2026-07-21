import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";
import { SUPABASE_REALTIME_OPTIONS } from "@/lib/supabase/realtime-config";

// Browser client uses anon key → RLS enforced on all realtime subscriptions
let browserClientSingleton: SupabaseClient<Database> | null = null;

/**
 * Browser Supabase client (use in Client Components) — one instance per tab.
 * Each SupabaseClient owns its own physical Realtime WebSocket; every
 * `.channel()` call on the SAME instance multiplexes over that one socket,
 * but a fresh instance per call opens a brand new socket. With 38+
 * usePostgresRealtime call sites (several per component, e.g.
 * waiter-table-detail.tsx calls it 3x), a non-memoized createClient() here
 * was the root cause of the Realtime connection-count quota being blown
 * (3,761 vs a 200 cap) — dozens of sockets per open staff/guest tab instead
 * of one shared, multiplexed socket.
 */
export function createClient() {
  if (!browserClientSingleton) {
    browserClientSingleton = createSupabaseBrowserClient<Database>(
      env.supabaseUrl,
      env.supabaseAnonKey,
      SUPABASE_REALTIME_OPTIONS
    );
  }
  return browserClientSingleton;
}

/** @deprecated Use `createClient()` */
export const createBrowserClient = createClient;
