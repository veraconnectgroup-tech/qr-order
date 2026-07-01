import { deriveGuestMemoryToken } from "@/lib/guest/denis-guest-memory-token";
import {
  monthKeyFromMs,
  type EngagementMessage,
} from "@/lib/denis/retention/guest-engagement-loop";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

function memoryExpiresAt(ttlDays: number): string {
  return new Date(Date.now() + ttlDays * 86_400_000).toISOString();
}

/** Record GDPR engagement marketing consent (Q2). */
export async function grantGuestEngagementConsent(
  admin: SupabaseClient,
  input: {
    locationId: string;
    orgId: string;
    deviceFingerprint: string;
    ttlDays?: number;
  }
): Promise<boolean> {
  const guestToken = deriveGuestMemoryToken(
    input.locationId,
    input.deviceFingerprint
  );
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("denis_guest_memory" as never)
    .select("consented_at, expires_at")
    .eq("location_id", input.locationId)
    .eq("guest_token", guestToken)
    .maybeSingle();

  const row = existing as { consented_at: string | null; expires_at: string } | null;

  if (row?.consented_at) {
    const { error } = await admin
      .from("denis_guest_memory" as never)
      .update({
        engagement_consent_at: now,
        updated_at: now,
        expires_at: memoryExpiresAt(input.ttlDays ?? 365),
      } as never)
      .eq("location_id", input.locationId)
      .eq("guest_token", guestToken);

    if (error) {
      logger.warn("grantGuestEngagementConsent update failed", {
        error: error.message,
      });
      return false;
    }
    return true;
  }

  const { error } = await admin.from("denis_guest_memory" as never).insert({
    org_id: input.orgId,
    location_id: input.locationId,
    guest_token: guestToken,
    consent_scopes: [],
    consented_at: now,
    engagement_consent_at: now,
    expires_at: memoryExpiresAt(input.ttlDays ?? 365),
    updated_at: now,
  } as never);

  if (error) {
    logger.warn("grantGuestEngagementConsent insert failed", {
      error: error.message,
    });
    return false;
  }

  return true;
}

/** Persist a sent engagement message + monthly counter (Q2). */
export async function recordGuestEngagementSend(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    message: EngagementMessage;
    guestToken?: string;
    deviceFingerprint?: string;
  }
): Promise<void> {
  const guestToken =
    input.guestToken ??
    (input.deviceFingerprint
      ? deriveGuestMemoryToken(input.locationId, input.deviceFingerprint)
      : null);

  if (!guestToken) {
    logger.warn("recordGuestEngagementSend missing guest identity");
    return;
  }
  const nowMs = Date.parse(input.message.sentAt);
  const monthKey = monthKeyFromMs(Number.isFinite(nowMs) ? nowMs : Date.now());
  const now = new Date().toISOString();

  const { data: row } = await admin
    .from("denis_guest_memory" as never)
    .select("engagement_month_key, engagement_month_count")
    .eq("location_id", input.locationId)
    .eq("guest_token", guestToken)
    .maybeSingle();

  const memory = row as {
    engagement_month_key: string | null;
    engagement_month_count: number;
  } | null;

  const nextCount =
    memory?.engagement_month_key === monthKey
      ? (memory.engagement_month_count ?? 0) + 1
      : 1;

  await admin.from("denis_guest_engagement_events" as never).insert({
    org_id: input.orgId,
    location_id: input.locationId,
    guest_token: guestToken,
    trigger: input.message.trigger,
    channel: input.message.channel,
    message: input.message.message,
    personalized_offer: input.message.personalizedOffer,
    sent_at: input.message.sentAt,
  } as never);

  const patch: Record<string, string | number> = {
    engagement_month_key: monthKey,
    engagement_month_count: nextCount,
    updated_at: now,
  };

  if (input.message.trigger === "win_back") {
    patch.win_back_sent_at = input.message.sentAt;
  }

  await admin
    .from("denis_guest_memory" as never)
    .update(patch as never)
    .eq("location_id", input.locationId)
    .eq("guest_token", guestToken);
}
