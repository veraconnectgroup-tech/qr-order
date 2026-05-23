import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Browser client uses anon key → RLS enforced on all realtime subscriptions
/** Browser Supabase client (use in Client Components). */
export function createClient() {
  return createSupabaseBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** @deprecated Use `createClient()` */
export const createBrowserClient = createClient;
