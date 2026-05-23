import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";
import { getSupabaseServerUrl } from "@/lib/supabase/config";

/** Server Supabase client (use in Server Components, Route Handlers, Server Actions). */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createSupabaseServerClient<Database>(
    getSupabaseServerUrl(),
    env.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
}

/** @deprecated Use `createServerSupabase()` */
export const createServerClient = createServerSupabase;
