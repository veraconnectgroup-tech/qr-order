import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseServerUrl } from "@/lib/supabase/config";

/** Service-role client for API routes and server jobs. Uses REST API URL (see config.ts). */
export function createAdminClient() {
  return createClient<Database>(
    getSupabaseServerUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
