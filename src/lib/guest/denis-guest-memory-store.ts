import type {
  GuestMemoryProjection,
  GuestMemoryScope,
  GuestMemorySyncPayload,
} from "@/lib/denis/platform/guest-memory-types";
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
};

const VALID_SCOPES = new Set<GuestMemoryScope>([
  "allergies",
  "favorites",
  "language",
]);

function memoryExpiresAt(ttlDays: number): string {
  return new Date(Date.now() + ttlDays * 86_400_000).toISOString();
}

function rowToProjection(row: GuestMemoryRow): GuestMemoryProjection {
  return {
    favoriteProductIds: row.favorite_product_ids ?? [],
    allergySheetIds: row.allergy_sheet_ids ?? [],
    allergyLabels: row.allergy_labels ?? [],
    preferredLanguage: row.preferred_language,
    visitCount: row.visit_count ?? 0,
    lastVisitItemNames: row.last_visit_item_names ?? [],
    lastVisitAt: row.last_visit_at,
  };
}

function isActiveConsent(row: GuestMemoryRow | null): row is GuestMemoryRow {
  if (!row?.consented_at) return false;
  return new Date(row.expires_at).getTime() > Date.now();
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
    .select(
      "consent_scopes, consented_at, favorite_product_ids, last_visit_item_names, allergy_labels, allergy_sheet_ids, preferred_language, visit_count, last_visit_at, expires_at"
    )
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
    expires_at: expiresAt,
    updated_at: now,
  };

  const { data, error } = await admin
    .from("denis_guest_memory" as never)
    .upsert(payload as never, { onConflict: "location_id,guest_token" })
    .select(
      "consent_scopes, consented_at, favorite_product_ids, last_visit_item_names, allergy_labels, allergy_sheet_ids, preferred_language, visit_count, last_visit_at, expires_at"
    )
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
    recordVisit?: { itemNames: string[] };
  }
): Promise<GuestMemoryProjection | null> {
  const guestToken = deriveGuestMemoryToken(
    input.locationId,
    input.deviceFingerprint
  );

  const { data: existing, error: loadError } = await admin
    .from("denis_guest_memory" as never)
    .select(
      "consent_scopes, consented_at, favorite_product_ids, last_visit_item_names, allergy_labels, allergy_sheet_ids, preferred_language, visit_count, last_visit_at, expires_at"
    )
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

  const update: Record<string, unknown> = {
    updated_at: now,
    expires_at: memoryExpiresAt(input.ttlDays),
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

  if (input.recordVisit && visitItems.length > 0) {
    update.last_visit_item_names = [...new Set(visitItems)].slice(0, 8);
    update.last_visit_at = now;
    update.visit_count = (row.visit_count ?? 0) + 1;
  } else if (input.sync.lastVisitItemNames) {
    update.last_visit_item_names = input.sync.lastVisitItemNames.slice(0, 8);
  }

  const { data, error } = await admin
    .from("denis_guest_memory" as never)
    .update(update as never)
    .eq("location_id", input.locationId)
    .eq("guest_token", guestToken)
    .select(
      "consent_scopes, consented_at, favorite_product_ids, last_visit_item_names, allergy_labels, allergy_sheet_ids, preferred_language, visit_count, last_visit_at, expires_at"
    )
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
