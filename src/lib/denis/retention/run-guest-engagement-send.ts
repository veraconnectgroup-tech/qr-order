import { recordGuestEngagementSend } from "@/lib/denis/learning/guest-memory/persist-guest-engagement";
import {
  monthKeyFromMs,
  type EngagementMenuProduct,
  type EngagementMessage,
} from "@/lib/denis/retention/guest-engagement-loop";
import {
  loadEngagementSendContext,
  type EngagementSendContext,
} from "@/lib/denis/retention/load-engagement-send-context";
import { planGuestEngagementMessages } from "@/lib/denis/retention/plan-guest-engagement";
import { routeGuestNotification } from "@/lib/notifications/channel-router";
import { loadGuestNotificationPreferences } from "@/lib/notifications/guest-preferences";
import { deriveGuestMemoryToken } from "@/lib/guest/denis-guest-memory-token";
import { logger } from "@/lib/logger";
import { notifyGuestSessionPush } from "@/lib/push/notify-guest-session";
import {
  normalizeGuestMemoryProjection,
  type GuestMemoryProjection,
  type PreferredMealPattern,
} from "@/lib/denis/platform/guest-memory-types";
import type { SupabaseClient } from "@supabase/supabase-js";

type EngagementMemoryRow = {
  guest_token: string;
  org_id: string;
  favorite_product_ids: string[] | null;
  last_visit_item_names: string[] | null;
  allergy_labels: string[] | null;
  allergy_sheet_ids: string[] | null;
  preferred_language: string | null;
  preferred_meal_pattern: string | null;
  visit_count: number;
  last_visit_at: string | null;
  engagement_consent_at: string;
  birthday_month: number | null;
  win_back_sent_at: string | null;
  engagement_month_key: string | null;
  engagement_month_count: number;
};

export type GuestEngagementSendResult = {
  candidates: number;
  planned: number;
  sent: number;
  skippedNoDispatch: number;
};

function rowToGuest(row: EngagementMemoryRow): GuestMemoryProjection {
  return normalizeGuestMemoryProjection({
    favoriteProductIds: row.favorite_product_ids ?? [],
    allergySheetIds: row.allergy_sheet_ids ?? [],
    allergyLabels: row.allergy_labels ?? [],
    preferredLanguage: row.preferred_language,
    preferredMealPattern: (row.preferred_meal_pattern ??
      null) as PreferredMealPattern | null,
    visitCount: row.visit_count ?? 0,
    lastVisitItemNames: row.last_visit_item_names ?? [],
    lastVisitAt: row.last_visit_at,
    engagementConsentAt: row.engagement_consent_at,
    birthdayMonth: row.birthday_month,
    winBackSentAt: row.win_back_sent_at,
    engagementMonthCount: row.engagement_month_count ?? 0,
  });
}

function messagesSentThisMonth(
  row: EngagementMemoryRow,
  nowMs: number
): number {
  const monthKey = monthKeyFromMs(nowMs);
  if (row.engagement_month_key === monthKey) {
    return row.engagement_month_count ?? 0;
  }
  return 0;
}

async function resolvePushSessionForGuestToken(
  admin: SupabaseClient,
  input: { locationId: string; guestToken: string }
): Promise<string | null> {
  const { data: devices, error } = await admin
    .from("session_devices")
    .select(
      "session_id, device_fingerprint, last_seen_at, table_sessions!inner(location_id)"
    )
    .eq("table_sessions.location_id", input.locationId)
    .order("last_seen_at", { ascending: false })
    .limit(200);

  if (error) {
    logger.warn("resolvePushSessionForGuestToken failed", {
      error: error.message,
    });
    return null;
  }

  for (const row of (devices ?? []) as Array<{
    session_id: string;
    device_fingerprint: string;
  }>) {
    const token = deriveGuestMemoryToken(
      input.locationId,
      row.device_fingerprint
    );
    if (token !== input.guestToken) continue;

    const { count } = await admin
      .from("guest_push_subscriptions" as never)
      .select("id", { count: "exact", head: true })
      .eq("session_id", row.session_id);

    if ((count ?? 0) > 0) return row.session_id;
  }

  return null;
}

async function guestHasPushSubscription(
  admin: SupabaseClient,
  input: { locationId: string; guestToken: string }
): Promise<boolean> {
  const sessionId = await resolvePushSessionForGuestToken(admin, input);
  return sessionId != null;
}

async function resolveDeviceFingerprintForGuestToken(
  admin: SupabaseClient,
  input: { locationId: string; guestToken: string }
): Promise<string | null> {
  const { data: devices } = await admin
    .from("session_devices")
    .select(
      "device_fingerprint, table_sessions!inner(location_id)"
    )
    .eq("table_sessions.location_id", input.locationId)
    .order("last_seen_at", { ascending: false })
    .limit(200);

  for (const row of (devices ?? []) as Array<{ device_fingerprint: string }>) {
    const token = deriveGuestMemoryToken(
      input.locationId,
      row.device_fingerprint
    );
    if (token === input.guestToken) return row.device_fingerprint;
  }
  return null;
}

async function dispatchEngagementMessage(
  admin: SupabaseClient,
  input: {
    locationId: string;
    guestToken: string;
    message: EngagementMessage;
    language?: string | null;
  }
): Promise<boolean> {
  if (input.message.channel === "push") {
    const sessionId = await resolvePushSessionForGuestToken(admin, {
      locationId: input.locationId,
      guestToken: input.guestToken,
    });
    if (!sessionId) return false;

    const result = await notifyGuestSessionPush(admin, {
      sessionId,
      pushType: "guest-denis-message",
      message: input.message.message,
      language: input.language ?? undefined,
    });
    return result.sent > 0;
  }

  if (input.message.channel === "email") {
    logger.info("guest engagement email queued (no guest email on file)", {
      locationId: input.locationId,
      trigger: input.message.trigger,
    });
    return false;
  }

  if (input.message.channel === "sms") {
    const deviceFingerprint = await resolveDeviceFingerprintForGuestToken(
      admin,
      { locationId: input.locationId, guestToken: input.guestToken }
    );
    if (!deviceFingerprint) return false;

    const prefs = await loadGuestNotificationPreferences(admin, {
      locationId: input.locationId,
      deviceFingerprint,
    });

    const result = await routeGuestNotification(admin, {
      locationId: input.locationId,
      deviceFingerprint,
      kind: "marketing",
      templateId: `engagement.${input.message.trigger}` as "engagement.win_back",
      message: input.message.message,
      title: "Denis",
      phone: prefs?.phoneE164,
      pushAvailable: false,
    });
    return result.sentVia != null;
  }

  return false;
}

export async function sendGuestEngagementForRow(
  admin: SupabaseClient,
  input: {
    locationId: string;
    row: EngagementMemoryRow;
    context: EngagementSendContext;
    nowMs?: number;
  }
): Promise<{ planned: number; sent: number; skippedNoDispatch: number }> {
  const nowMs = input.nowMs ?? Date.now();
  const guest = rowToGuest(input.row);
  const hasPush = await guestHasPushSubscription(admin, {
    locationId: input.locationId,
    guestToken: input.row.guest_token,
  });

  const deviceFingerprint = await resolveDeviceFingerprintForGuestToken(admin, {
    locationId: input.locationId,
    guestToken: input.row.guest_token,
  });

  const notifPrefs = deviceFingerprint
    ? await loadGuestNotificationPreferences(admin, {
        locationId: input.locationId,
        deviceFingerprint,
      })
    : null;

  const messages = planGuestEngagementMessages({
    guest,
    newMenuItems: input.context.newMenuItems,
    upcomingEvents: input.context.upcomingEvents,
    engagementConsentAt: input.row.engagement_consent_at,
    messagesSentThisMonth: messagesSentThisMonth(input.row, nowMs),
    winBackAlreadySent: Boolean(input.row.win_back_sent_at),
    birthdayMonth: input.row.birthday_month,
    hasPushSubscription: hasPush,
    hasEmail: false,
    hasPhone: Boolean(notifPrefs?.phoneE164 && notifPrefs.marketingConsentAt),
    preferredChannel: notifPrefs?.preferredChannel ?? null,
    language: input.row.preferred_language ?? "sr",
    nowMs,
  });

  let sent = 0;
  let skippedNoDispatch = 0;

  for (const message of messages) {
    const dispatched = await dispatchEngagementMessage(admin, {
      locationId: input.locationId,
      guestToken: input.row.guest_token,
      message,
      language: input.row.preferred_language,
    });

    if (!dispatched) {
      skippedNoDispatch += 1;
      continue;
    }

    await recordGuestEngagementSend(admin, {
      orgId: input.row.org_id,
      locationId: input.locationId,
      guestToken: input.row.guest_token,
      message,
    });
    sent += 1;
  }

  return { planned: messages.length, sent, skippedNoDispatch };
}

export async function runGuestEngagementSendTick(
  admin: SupabaseClient,
  input: {
    locationId: string;
    orgId: string;
    limit?: number;
    nowMs?: number;
  }
): Promise<GuestEngagementSendResult> {
  const limit = input.limit ?? 50;
  const nowMs = input.nowMs ?? Date.now();

  const context = await loadEngagementSendContext(admin, {
    locationId: input.locationId,
    nowMs,
  });

  const { data: rows, error } = await admin
    .from("denis_guest_memory" as never)
    .select(
      "guest_token, org_id, favorite_product_ids, last_visit_item_names, allergy_labels, allergy_sheet_ids, preferred_language, preferred_meal_pattern, visit_count, last_visit_at, engagement_consent_at, birthday_month, win_back_sent_at, engagement_month_key, engagement_month_count"
    )
    .eq("location_id", input.locationId)
    .not("engagement_consent_at", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.warn("runGuestEngagementSendTick load failed", {
      locationId: input.locationId,
      error: error.message,
    });
    return { candidates: 0, planned: 0, sent: 0, skippedNoDispatch: 0 };
  }

  const candidates = (rows ?? []) as EngagementMemoryRow[];
  let planned = 0;
  let sent = 0;
  let skippedNoDispatch = 0;

  for (const row of candidates) {
    const result = await sendGuestEngagementForRow(admin, {
      locationId: input.locationId,
      row,
      context,
      nowMs,
    });
    planned += result.planned;
    sent += result.sent;
    skippedNoDispatch += result.skippedNoDispatch;
  }

  return {
    candidates: candidates.length,
    planned,
    sent,
    skippedNoDispatch,
  };
}

export async function runGuestEngagementSendAllLocations(
  admin: SupabaseClient,
  options?: { limitPerLocation?: number; locationLimit?: number }
): Promise<{
  locations: number;
  planned: number;
  sent: number;
  skippedNoDispatch: number;
}> {
  const locationLimit = options?.locationLimit ?? 50;

  const { data: locationRows } = await admin
    .from("locations")
    .select("id, org_id")
    .eq("ai_concierge_enabled", true)
    .limit(locationLimit);

  let locations = 0;
  let planned = 0;
  let sent = 0;
  let skippedNoDispatch = 0;

  for (const row of (locationRows ?? []) as Array<{ id: string; org_id: string }>) {
    const result = await runGuestEngagementSendTick(admin, {
      locationId: row.id,
      orgId: row.org_id,
      limit: options?.limitPerLocation ?? 50,
    });
    locations += 1;
    planned += result.planned;
    sent += result.sent;
    skippedNoDispatch += result.skippedNoDispatch;
  }

  return { locations, planned, sent, skippedNoDispatch };
}

export type { EngagementMemoryRow, EngagementMenuProduct };
