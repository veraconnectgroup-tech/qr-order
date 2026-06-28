import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";
import { SUPABASE_REALTIME_OPTIONS } from "@/lib/supabase/realtime-config";

// Browser client uses anon key → RLS enforced on all realtime subscriptions
/** Browser Supabase client (use in Client Components). */
export function createClient() {
  return createSupabaseBrowserClient<Database>(
    env.supabaseUrl,
    env.supabaseAnonKey,
    SUPABASE_REALTIME_OPTIONS
  );
}

/** @deprecated Use `createClient()` */
export const createBrowserClient = createClient;
