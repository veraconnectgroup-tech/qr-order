import { deriveGuestMemoryToken } from "@/lib/guest/denis-guest-memory-token";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

function memoryExpiresAt(ttlDays: number): string {
  return new Date(Date.now() + ttlDays * 86_400_000).toISOString();
}

/** Persist review prompt anti-spam timestamps (Q1). Requires active memory consent. */
export async function persistReviewPromptMemory(
  admin: SupabaseClient,
  input: {
    locationId: string;
    deviceFingerprint: string;
    action: "prompt_shown" | "dismissed" | "clicked";
    ttlDays?: number;
    triggerMoment?: string | null;
    experienceScore?: number | null;
  }
): Promise<void> {
  const guestToken = deriveGuestMemoryToken(
    input.locationId,
    input.deviceFingerprint
  );
  const ttlDays = input.ttlDays ?? 365;
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("denis_guest_memory" as never)
    .select("consented_at, expires_at")
    .eq("location_id", input.locationId)
    .eq("guest_token", guestToken)
    .maybeSingle();

  const row = existing as { consented_at: string | null; expires_at: string } | null;
  if (!row?.consented_at || new Date(row.expires_at).getTime() <= Date.now()) {
    return;
  }

  const patch: Record<string, string> = {
    updated_at: now,
    expires_at: memoryExpiresAt(ttlDays),
  };

  if (input.action === "prompt_shown" || input.action === "clicked") {
    patch.last_review_prompt_at = now;
  }
  if (input.action === "dismissed") {
    patch.last_review_dismiss_at = now;
    patch.last_review_prompt_at = now;
  }

  const { error } = await admin
    .from("denis_guest_memory" as never)
    .update(patch as never)
    .eq("location_id", input.locationId)
    .eq("guest_token", guestToken);

  if (error) {
    logger.warn("Guest memory review prompt persist failed", {
      locationId: input.locationId,
      action: input.action,
      triggerMoment: input.triggerMoment ?? null,
      experienceScore: input.experienceScore ?? null,
      error: error.message,
    });
  }
}
