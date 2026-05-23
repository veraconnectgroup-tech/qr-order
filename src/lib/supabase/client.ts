import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

// Browser client uses anon key → RLS enforced on all realtime subscriptions
/** Browser Supabase client (use in Client Components). */
export function createClient() {
  return createSupabaseBrowserClient<Database>(
    env.supabaseUrl,
    env.supabaseAnonKey
  );
}

/** @deprecated Use `createClient()` */
export const createBrowserClient = createClient;
