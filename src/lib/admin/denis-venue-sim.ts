"use server";

import { z } from "zod";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { runVenueSim } from "@/lib/denis/eval/run-venue-sim";
import type {
  VenueSimExperimentOverrides,
  VenueSimReport,
} from "@/lib/denis/eval/venue-sim-types";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import { createAdminClient } from "@/lib/supabase/admin";

const venueSimInputSchema = z.object({
  sessionId: z.string().uuid(),
  overrides: z.object({
    orderingFlow: z.enum(["denis_short", "classic_chatty"]).optional(),
    foodAfterDrinks: z.boolean().optional(),
    maxUpsellsPerSession: z.number().int().min(0).max(10).optional(),
    rushSkipUpsell: z.boolean().optional(),
    playbookVariant: z.enum(["A", "B"]).nullable().optional(),
  }),
});

export type RunVenueSimResult =
  | { ok: true; report: VenueSimReport }
  | { ok: false; error: string };

export async function runVenueSimForSession(
  raw: z.infer<typeof venueSimInputSchema>
): Promise<RunVenueSimResult> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { ok: false, error: "No location assigned." };
  }

  const parsed = venueSimInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid simulation input." };
  }

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("ai_sessions")
    .select("id")
    .eq("id", parsed.data.sessionId)
    .eq("location_id", locationId)
    .maybeSingle();

  if (!session) {
    return { ok: false, error: "Session not found for this location." };
  }

  const events = await loadDenisTimeline(admin, parsed.data.sessionId);
  if (events.length === 0) {
    return {
      ok: false,
      error: "No Denis timeline events — enable shadow or denis_only rollout first.",
    };
  }

  const baselineConfig = await loadConciergeConfigForLocation(locationId);
  const overrides: VenueSimExperimentOverrides = {
    ...parsed.data.overrides,
    playbookVariant:
      parsed.data.overrides.playbookVariant === undefined
        ? undefined
        : parsed.data.overrides.playbookVariant,
  };

  const report = runVenueSim(
    parsed.data.sessionId,
    events,
    baselineConfig,
    overrides
  );

  if (report.turns.length === 0) {
    return {
      ok: false,
      error: "Timeline has no traced guest turns to replay.",
    };
  }

  return { ok: true, report };
}
