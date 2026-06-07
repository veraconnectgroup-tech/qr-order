import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { loadLocationRhythmPriors } from "@/lib/denis/config/load-rhythm-priors";
import { resolveRhythmPriors } from "@/lib/denis/config/resolve-rhythm-priors";
import type { ResolvedRhythmContext } from "@/lib/denis/config/rhythm-prior-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadResolvedRhythmContext(
  admin: SupabaseClient,
  input: {
    locationId: string;
    config: ConciergeConfig;
    now?: Date;
  }
): Promise<ResolvedRhythmContext> {
  const row = await loadLocationRhythmPriors(admin, input.locationId);

  return resolveRhythmPriors({
    config: input.config,
    priors: row?.priors ?? null,
    now: input.now,
    timezone: row?.timezone,
  });
}
