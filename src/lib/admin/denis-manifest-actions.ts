"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import {
  buildPromotedStoragePatch,
  buildRollbackStoragePatch,
  extractManifestFromStorage,
  extractManifestHistory,
} from "@/lib/denis/cognition/manifest/manifest-promote-gate";
import {
  evaluateManifestPromoteGate,
  type ManifestPromoteGateResult,
} from "@/lib/denis/eval/run-manifest-promote-gate";
import {
  parseVenueManifest,
  VenueManifestSchema,
} from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import { invalidateConciergeConfigCache } from "@/lib/denis/config/config-cache";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import { createAdminClient } from "@/lib/supabase/admin";

const promoteInputSchema = z.object({
  manifestRaw: z.unknown(),
  sessionId: z.string().uuid().optional(),
});

export type DenisManifestAdminState = {
  activeManifest: ReturnType<typeof extractManifestFromStorage>;
  history: ReturnType<typeof extractManifestHistory>;
  activeVersion: number | null;
};

export async function loadDenisManifestAdminState(): Promise<
  DenisManifestAdminState | { error: string }
> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "No location assigned." };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", locationId)
    .maybeSingle();

  const raw = (row as { ai_concierge_config?: unknown } | null)
    ?.ai_concierge_config;
  const activeManifest = extractManifestFromStorage(raw);
  const history = extractManifestHistory(raw);

  const denis =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).denis
      : null;
  const activeVersion =
    denis &&
    typeof denis === "object" &&
    !Array.isArray(denis) &&
    typeof (denis as Record<string, unknown>).activeManifestVersion === "number"
      ? ((denis as Record<string, unknown>).activeManifestVersion as number)
      : activeManifest?.manifestVersion ?? null;

  return { activeManifest, history, activeVersion };
}

async function loadLocationStorage(locationId: string) {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", locationId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false as const, error: error?.message ?? "Location not found." };
  }

  return {
    ok: true as const,
    admin,
    raw: (row as { ai_concierge_config: unknown }).ai_concierge_config,
  };
}

function parseProposedManifest(raw: unknown) {
  const parsed = VenueManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid venue manifest JSON." };
  }
  return { ok: true as const, manifest: parsed.data };
}

export async function runManifestPromoteGateCheck(
  raw: z.infer<typeof promoteInputSchema>
): Promise<
  { ok: true; gate: ManifestPromoteGateResult } | { ok: false; error: string }
> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { ok: false, error: "No location assigned." };
  }

  const parsed = promoteInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid promote input." };
  }

  const proposed = parseProposedManifest(parsed.data.manifestRaw);
  if (!proposed.ok) {
    return { ok: false, error: proposed.error };
  }

  const storage = await loadLocationStorage(locationId);
  if (!storage.ok) {
    return { ok: false, error: storage.error };
  }

  const currentManifest = extractManifestFromStorage(storage.raw);
  const baseConfig = await loadConciergeConfigForLocation(locationId, {
    bypassCache: true,
  });

  let timelineEvents;
  if (parsed.data.sessionId) {
    const { data: session } = await storage.admin
      .from("ai_sessions")
      .select("id")
      .eq("id", parsed.data.sessionId)
      .eq("location_id", locationId)
      .maybeSingle();

    if (!session) {
      return { ok: false, error: "Session not found for this location." };
    }

    timelineEvents = await loadDenisTimeline(storage.admin, parsed.data.sessionId);
  }

  const gate = evaluateManifestPromoteGate({
    baseConfig,
    currentManifest,
    proposedManifest: proposed.manifest,
    timelineEvents,
    simSessionId: parsed.data.sessionId ?? null,
  });

  return { ok: true, gate };
}

export async function promoteVenueManifest(
  raw: z.infer<typeof promoteInputSchema>
): Promise<
  | { success: true; version: number }
  | { error: string; violations?: string[] }
> {
  const check = await runManifestPromoteGateCheck(raw);
  if (!check.ok) {
    return { error: check.error };
  }

  if (!check.gate.ok) {
    return { error: "Promote blocked by sim gate.", violations: check.gate.violations };
  }

  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "No location assigned." };
  }

  const proposed = parseProposedManifest(raw.manifestRaw);
  if (!proposed.ok) {
    return { error: proposed.error };
  }

  const storage = await loadLocationStorage(locationId);
  if (!storage.ok) {
    return { error: storage.error };
  }

  const version = check.gate.nextVersion;
  const manifestToSave = {
    ...proposed.manifest,
    manifestVersion: 1 as const,
  };

  const historyEntry = {
    version,
    manifest: manifestToSave,
    promotedAt: new Date().toISOString(),
  };

  const patch = buildPromotedStoragePatch({
    existingRaw: storage.raw,
    manifest: manifestToSave,
    historyEntry,
  });

  const { error: updateError } = await storage.admin
    .from("locations")
    .update({
      ai_concierge_config: patch as never,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (updateError) {
    return { error: updateError.message };
  }

  await invalidateConciergeConfigCache(locationId);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/denis-sim");

  return { success: true, version };
}

export async function rollbackVenueManifest(): Promise<
  { success: true; version: number } | { error: string }
> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "No location assigned." };
  }

  const storage = await loadLocationStorage(locationId);
  if (!storage.ok) {
    return { error: storage.error };
  }

  const history = extractManifestHistory(storage.raw);
  if (history.length < 2) {
    return { error: "No previous manifest version to rollback to." };
  }

  const previous = history[1];
  const patch = buildRollbackStoragePatch({
    existingRaw: storage.raw,
    rollbackManifest: previous.manifest,
    rollbackVersion: previous.version,
  });

  const { error: updateError } = await storage.admin
    .from("locations")
    .update({
      ai_concierge_config: patch as never,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (updateError) {
    return { error: updateError.message };
  }

  await invalidateConciergeConfigCache(locationId);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/denis-sim");

  return { success: true, version: previous.version };
}

/** Validate manifest JSON without running gate (admin editor helper). */
export async function validateVenueManifestDraft(
  manifestRaw: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const manifest = parseVenueManifest(manifestRaw);
  if (!manifest) {
    return { ok: false, error: "Invalid venue manifest." };
  }
  return { ok: true };
}
