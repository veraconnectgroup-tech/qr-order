import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env/public";

// Browser client uses anon key → RLS enforced on all realtime subscriptions
/** Browser Supabase client (use in Client Components). */
export function createClient() {
  return createSupabaseBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey
  );
}

/** @deprecated Use `createClient()` */
export const createBrowserClient = createClient;
