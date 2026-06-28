import {
  loadConciergeConfigForLocation,
  type LoadConciergeConfigOptions,
} from "@/lib/denis/config/load-concierge-config";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { resolveLiveAbConfigForSession } from "@/lib/denis/experiments/live-ab-store";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Load location config with live A/B variant merged for this session (M1). */
export async function loadConciergeConfigForSession(
  admin: SupabaseClient,
  input: {
    locationId: string;
    sessionToken: string | null | undefined;
    options?: LoadConciergeConfigOptions;
  }
): Promise<ConciergeConfig> {
  const base = await loadConciergeConfigForLocation(input.locationId, input.options);
  const resolved = await resolveLiveAbConfigForSession(admin, {
    locationId: input.locationId,
    sessionToken: input.sessionToken,
    baseConfig: base,
  });
  return resolved.config;
}
