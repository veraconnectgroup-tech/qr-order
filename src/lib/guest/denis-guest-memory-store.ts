import type {
  GuestMemoryProjection,
  GuestMemoryScope,
  GuestMemorySyncPayload,
  PreferredMealPattern,
} from "@/lib/denis/platform/guest-memory-types";
import { normalizeGuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import {
  appendRelationshipVisit,
  parseGuestRelationshipSnapshot,
  refreshRelationshipSnapshot,
} from "@/lib/denis/learning/guest-memory/build-relationship-timeline";
import { detectPreferenceEvolution } from "@/lib/denis/learning/guest-memory/detect-preference-evolution";
import { detectGuestOccasions } from "@/lib/denis/learning/guest-memory/detect-guest-occasions";
import { deriveGuestMemoryToken } from "@/lib/guest/denis-guest-memory-token";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

type GuestMemoryRow = {
  consent_scopes: string[];
  consented_at: string | null;
  favorite_product_ids: string[];
  last_visit_item_names: string[];
  allergy_labels: string[];
  allergy_sheet_ids: string[];
  preferred_language: string | null;
  visit_count: number;
  last_visit_at: string | null;
  expires_at: string;
  modifier_preferences?: string[];
  avg_spend_cents?: number | null;
  avg_session_minutes?: number | null;
  preferred_meal_pattern?: string | null;
  last_feedback_sentiment?: string | null;
  last_feedback_category?: string | null;
  dessert_nudge_dismiss_count?: number;
  skip_dessert_nudge?: boolean;
  engagement_consent_at?: string | null;
  birthday_month?: number | null;
  win_back_sent_at?: string | null;
  engagement_month_count?: number;
  relationship_snapshot?: unknown;
};

const VALID_SCOPES = new Set<GuestMemoryScope>([
  "allergies",
  "favorites",
  "language",
  "relationship",
]);

const MEMORY_SELECT =
  "consent_scopes, consented_at, favorite_product_ids, last_visit_item_names, allergy_labels, allergy_sheet_ids, preferred_language, visit_count, last_visit_at, expires_at, modifier_preferences, avg_spend_cents, avg_session_minutes, preferred_meal_pattern, last_feedback_sentiment, last_feedback_category, dessert_nudge_dismiss_count, skip_dessert_nudge, engagement_consent_at, birthday_month, win_back_sent_at, engagement_month_count, relationship_snapshot";

function memoryExpiresAt(ttlDays: number): string {
  return new Date(Date.now() + ttlDays * 86_400_000).toISOString();
}

function isActiveConsent(row: GuestMemoryRow | null): row is GuestMemoryRow {
  if (!row?.consented_at) return false;
  return new Date(row.expires_at).getTime() > Date.now();
}

function rowToProjection(row: GuestMemoryRow): GuestMemoryProjection {
  const relationship = parseGuestRelationshipSnapshot(row.relationship_snapshot);
  const visitCount = row.visit_count ?? 0;
  const occasions = detectGuestOccasions({
    relationship,
    visitCount,
  });

  return normalizeGuestMemoryProjection({
    favoriteProductIds: row.favorite_product_ids ?? [],
    allergySheetIds: row.allergy_sheet_ids ?? [],
    allergyLabels: row.allergy_labels ?? [],
    preferredLanguage: row.preferred_language,
    visitCount,
    lastVisitItemNames: row.last_visit_item_names ?? [],
    lastVisitAt: row.last_visit_at,
    modifierPreferences: row.modifier_preferences ?? [],
    avgSpendCents: row.avg_spend_cents ?? null,
    avgSessionMinutes: row.avg_session_minutes ?? null,
    preferredMealPattern: (row.preferred_meal_pattern as PreferredMealPattern | null) ?? null,
    lastFeedbackSentiment:
      (row.last_feedback_sentiment as GuestMemoryProjection["lastFeedbackSentiment"]) ??
      null,
    lastFeedbackCategory: row.last_feedback_category ?? null,
    dessertNudgeDismissCount: row.dessert_nudge_dismiss_count ?? 0,
    skipDessertNudge: row.skip_dessert_nudge ?? false,
    engagementConsentAt: row.engagement_consent_at ?? null,
    birthdayMonth: row.birthday_month ?? null,
    winBackSentAt: row.win_back_sent_at ?? null,
    engagementMonthCount: row.engagement_month_count ?? 0,
    relationship,
    occasions,
    hasMemoryConsent: true,
    consentScopes: (row.consent_scopes ?? []).filter((scope): scope is GuestMemoryScope =>
      VALID_SCOPES.has(scope as GuestMemoryScope)
    ),
  });
}

export async function loadGuestMemoryProjection(
  admin: SupabaseClient,
  input: {
    locationId: string;
    deviceFingerprint: string;
  }
): Promise<GuestMemoryProjection | null> {
  const guestToken = deriveGuestMemoryToken(
    input.locationId,
    input.deviceFingerprint
  );

  const { data, error } = await admin
    .from("denis_guest_memory" as never)
    .select(MEMORY_SELECT)
    .eq("location_id", input.locationId)
    .eq("guest_token", guestToken)
    .maybeSingle();

  if (error) {
    logger.warn("Guest memory load failed", {
      locationId: input.locationId,
      error: error.message,
    });
    return null;
  }

  const row = data as GuestMemoryRow | null;
  if (!isActiveConsent(row)) return null;
  return rowToProjection(row);
}

export async function grantGuestMemoryConsent(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    deviceFingerprint: string;
    scopes: GuestMemoryScope[];
    ttlDays: number;
    sync?: GuestMemorySyncPayload;
  }
): Promise<GuestMemoryProjection | null> {
  const scopes = input.scopes.filter((scope) => VALID_SCOPES.has(scope));
  if (scopes.length === 0) return null;

  const guestToken = deriveGuestMemoryToken(
    input.locationId,
    input.deviceFingerprint
  );
  const now = new Date().toISOString();
  const expiresAt = memoryExpiresAt(input.ttlDays);

  const payload = {
    org_id: input.orgId,
    location_id: input.locationId,
    guest_token: guestToken,
    consent_scopes: scopes,
    consented_at: now,
    favorite_product_ids: input.sync?.favoriteProductIds ?? [],
    last_visit_item_names: input.sync?.lastVisitItemNames ?? [],
    allergy_labels: input.sync?.allergyLabels ?? [],
    allergy_sheet_ids: input.sync?.allergySheetIds ?? [],
    preferred_language: input.sync?.preferredLanguage ?? null,
    relationship_snapshot: { version: 1, timeline: [] },
    expires_at: expiresAt,
    updated_at: now,
  };

  const { data, error } = await admin
    .from("denis_guest_memory" as never)
    .upsert(payload as never, { onConflict: "location_id,guest_token" })
    .select(MEMORY_SELECT)
    .single();

  if (error) {
    logger.warn("Guest memory consent failed", {
      locationId: input.locationId,
      error: error.message,
    });
    return null;
  }

  const row = data as GuestMemoryRow;
  return rowToProjection(row);
}

export async function syncGuestMemoryProfile(
  admin: SupabaseClient,
  input: {
    locationId: string;
    deviceFingerprint: string;
    ttlDays: number;
    sync: GuestMemorySyncPayload;
    recordVisit?: {
      itemNames: string[];
      spendCents?: number | null;
      partySize?: number | null;
      partyNote?: string | null;
    };
  }
): Promise<GuestMemoryProjection | null> {
  const guestToken = deriveGuestMemoryToken(
    input.locationId,
    input.deviceFingerprint
  );

  const { data: existing, error: loadError } = await admin
    .from("denis_guest_memory" as never)
    .select(MEMORY_SELECT)
    .eq("location_id", input.locationId)
    .eq("guest_token", guestToken)
    .maybeSingle();

  if (loadError) {
    logger.warn("Guest memory sync load failed", {
      locationId: input.locationId,
      error: loadError.message,
    });
    return null;
  }

  const row = existing as GuestMemoryRow | null;
  if (!isActiveConsent(row)) return null;

  const now = new Date().toISOString();
  const visitItems =
    input.recordVisit?.itemNames.filter(Boolean) ??
    input.sync.lastVisitItemNames ??
    row.last_visit_item_names;

  let relationship = parseGuestRelationshipSnapshot(row.relationship_snapshot);
  const nextVisitCount =
    input.recordVisit && visitItems.length > 0
      ? (row.visit_count ?? 0) + 1
      : row.visit_count ?? 0;

  if (input.recordVisit && visitItems.length > 0) {
    relationship = appendRelationshipVisit(relationship, {
      visitedAt: now,
      itemNames: visitItems,
      spendCents: input.recordVisit.spendCents ?? input.sync.avgSpendCents ?? null,
      partySize: input.recordVisit.partySize ?? null,
      partyNote: input.recordVisit.partyNote ?? null,
      feedbackSentiment: input.sync.lastFeedbackSentiment ?? null,
    });
    relationship = refreshRelationshipSnapshot(relationship, {
      preferredMealPattern:
        input.sync.preferredMealPattern ??
        (row.preferred_meal_pattern as PreferredMealPattern | null) ??
        null,
      avgSpendCents: input.sync.avgSpendCents ?? row.avg_spend_cents ?? null,
      preferenceEvolution: detectPreferenceEvolution(relationship.timeline),
    });
  }

  const update: Record<string, unknown> = {
    updated_at: now,
    expires_at: memoryExpiresAt(input.ttlDays),
    relationship_snapshot: relationship,
  };

  if (input.sync.favoriteProductIds) {
    update.favorite_product_ids = input.sync.favoriteProductIds;
  }
  if (input.sync.allergyLabels) {
    update.allergy_labels = input.sync.allergyLabels;
  }
  if (input.sync.allergySheetIds) {
    update.allergy_sheet_ids = input.sync.allergySheetIds;
  }
  if (input.sync.preferredLanguage !== undefined) {
    update.preferred_language = input.sync.preferredLanguage;
  }
  if (input.sync.modifierPreferences) {
    update.modifier_preferences = input.sync.modifierPreferences;
  }
  if (input.sync.avgSpendCents !== undefined) {
    update.avg_spend_cents = input.sync.avgSpendCents;
  }
  if (input.sync.avgSessionMinutes !== undefined) {
    update.avg_session_minutes = input.sync.avgSessionMinutes;
  }
  if (input.sync.preferredMealPattern !== undefined) {
    update.preferred_meal_pattern = input.sync.preferredMealPattern;
  }
  if (input.sync.lastFeedbackSentiment !== undefined) {
    update.last_feedback_sentiment = input.sync.lastFeedbackSentiment;
  }
  if (input.sync.lastFeedbackCategory !== undefined) {
    update.last_feedback_category = input.sync.lastFeedbackCategory;
  }
  if (input.sync.dessertNudgeDismissCount !== undefined) {
    update.dessert_nudge_dismiss_count = input.sync.dessertNudgeDismissCount;
  }
  if (input.sync.skipDessertNudge !== undefined) {
    update.skip_dessert_nudge = input.sync.skipDessertNudge;
  }

  if (input.recordVisit && visitItems.length > 0) {
    update.last_visit_item_names = [...new Set(visitItems)].slice(0, 8);
    update.last_visit_at = now;
    update.visit_count = nextVisitCount;
  } else if (input.sync.lastVisitItemNames) {
    update.last_visit_item_names = input.sync.lastVisitItemNames.slice(0, 8);
  }

  const { data, error } = await admin
    .from("denis_guest_memory" as never)
    .update(update as never)
    .eq("location_id", input.locationId)
    .eq("guest_token", guestToken)
    .select(MEMORY_SELECT)
    .single();

  if (error) {
    logger.warn("Guest memory sync failed", {
      locationId: input.locationId,
      error: error.message,
    });
    return null;
  }

  return rowToProjection(data as GuestMemoryRow);
}

export async function deleteGuestMemory(
  admin: SupabaseClient,
  input: {
    locationId: string;
    deviceFingerprint: string;
  }
): Promise<boolean> {
  const guestToken = deriveGuestMemoryToken(
    input.locationId,
    input.deviceFingerprint
  );

  const { error } = await admin
    .from("denis_guest_memory" as never)
    .delete()
    .eq("location_id", input.locationId)
    .eq("guest_token", guestToken);

  if (error) {
    logger.warn("Guest memory delete failed", {
      locationId: input.locationId,
      error: error.message,
    });
    return false;
  }

  return true;
}
