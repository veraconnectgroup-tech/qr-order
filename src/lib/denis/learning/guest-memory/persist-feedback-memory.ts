import type {
  FeedbackCategory,
  FeedbackSentiment,
} from "@/lib/commerce/experience/resolve-experience-moment";
import { deriveGuestMemoryToken } from "@/lib/guest/denis-guest-memory-token";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

function memoryExpiresAt(ttlDays: number): string {
  return new Date(Date.now() + ttlDays * 86_400_000).toISOString();
}

/** Persist last visit feedback into consented guest memory (I2 — never exposed to guest). */
export async function persistGuestMemoryFeedback(
  admin: SupabaseClient,
  input: {
    locationId: string;
    deviceFingerprint: string;
    sentiment: FeedbackSentiment;
    category?: FeedbackCategory | null;
    ttlDays?: number;
  }
): Promise<void> {
  const guestToken = deriveGuestMemoryToken(
    input.locationId,
    input.deviceFingerprint
  );
  const ttlDays = input.ttlDays ?? 90;
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

  const { error } = await admin
    .from("denis_guest_memory" as never)
    .update({
      last_feedback_sentiment: input.sentiment,
      last_feedback_category: input.category ?? null,
      last_feedback_at: now,
      updated_at: now,
      expires_at: memoryExpiresAt(ttlDays),
    } as never)
    .eq("location_id", input.locationId)
    .eq("guest_token", guestToken);

  if (error) {
    logger.warn("Guest memory feedback persist failed", {
      locationId: input.locationId,
      error: error.message,
    });
  }
}
