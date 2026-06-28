import {
  DEFAULT_NOTIFICATION_RETENTION_DAYS,
  type GuestNotificationChannel,
  type GuestNotificationPreferences,
  type NotificationKind,
} from "@/lib/notifications/types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

type PreferenceRow = {
  location_id: string;
  device_fingerprint: string;
  phone_e164: string | null;
  preferred_channel: GuestNotificationChannel | null;
  sms_consent_at: string | null;
  whatsapp_consent_at: string | null;
  transactional_consent_at: string | null;
  marketing_consent_at: string | null;
  unsubscribed_at: string | null;
  retention_expires_at: string | null;
};

function mapRow(row: PreferenceRow): GuestNotificationPreferences {
  return {
    locationId: row.location_id,
    deviceFingerprint: row.device_fingerprint,
    phoneE164: row.phone_e164,
    preferredChannel: row.preferred_channel,
    smsConsentAt: row.sms_consent_at,
    whatsappConsentAt: row.whatsapp_consent_at,
    transactionalConsentAt: row.transactional_consent_at,
    marketingConsentAt: row.marketing_consent_at,
    unsubscribedAt: row.unsubscribed_at,
    retentionExpiresAt: row.retention_expires_at,
  };
}

function retentionExpiresAt(days = DEFAULT_NOTIFICATION_RETENTION_DAYS): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export async function loadGuestNotificationPreferences(
  admin: SupabaseClient,
  input: { locationId: string; deviceFingerprint: string }
): Promise<GuestNotificationPreferences | null> {
  const { data } = await admin
    .from("guest_notification_preferences" as never)
    .select(
      "location_id, device_fingerprint, phone_e164, preferred_channel, sms_consent_at, whatsapp_consent_at, transactional_consent_at, marketing_consent_at, unsubscribed_at, retention_expires_at"
    )
    .eq("location_id", input.locationId)
    .eq("device_fingerprint", input.deviceFingerprint)
    .maybeSingle();

  if (!data) return null;
  return mapRow(data as PreferenceRow);
}

export async function upsertGuestNotificationPreferences(
  admin: SupabaseClient,
  input: {
    locationId: string;
    deviceFingerprint: string;
    phoneE164?: string | null;
    preferredChannel?: GuestNotificationChannel | null;
    smsConsent?: boolean;
    whatsappConsent?: boolean;
    transactionalConsent?: boolean;
    marketingConsent?: boolean;
  }
): Promise<GuestNotificationPreferences | null> {
  const now = new Date().toISOString();
  const existing = await loadGuestNotificationPreferences(admin, {
    locationId: input.locationId,
    deviceFingerprint: input.deviceFingerprint,
  });

  const payload: Record<string, unknown> = {
    location_id: input.locationId,
    device_fingerprint: input.deviceFingerprint,
    updated_at: now,
    retention_expires_at: retentionExpiresAt(),
  };

  if (input.phoneE164 !== undefined) payload.phone_e164 = input.phoneE164;
  if (input.preferredChannel !== undefined) {
    payload.preferred_channel = input.preferredChannel;
  }
  if (input.smsConsent) payload.sms_consent_at = now;
  if (input.whatsappConsent) payload.whatsapp_consent_at = now;
  if (input.transactionalConsent) payload.transactional_consent_at = now;
  if (input.marketingConsent) payload.marketing_consent_at = now;

  if (!existing) {
    payload.created_at = now;
  }

  const { data, error } = await admin
    .from("guest_notification_preferences" as never)
    .upsert(payload as never, {
      onConflict: "location_id,device_fingerprint",
    })
    .select(
      "location_id, device_fingerprint, phone_e164, preferred_channel, sms_consent_at, whatsapp_consent_at, transactional_consent_at, marketing_consent_at, unsubscribed_at, retention_expires_at"
    )
    .maybeSingle();

  if (error) {
    logger.warn("upsertGuestNotificationPreferences failed", {
      error: error.message,
    });
    return null;
  }

  return data ? mapRow(data as PreferenceRow) : null;
}

export function isGuestSubscribed(
  prefs: GuestNotificationPreferences | null
): boolean {
  return !prefs?.unsubscribedAt;
}

export function hasChannelConsent(
  prefs: GuestNotificationPreferences | null,
  channel: GuestNotificationChannel,
  kind: NotificationKind
): boolean {
  if (prefs?.unsubscribedAt) return false;

  if (channel === "push") {
    if (kind === "marketing") return Boolean(prefs?.marketingConsentAt);
    return true;
  }

  if (!prefs?.phoneE164 && channel !== "email") return false;

  if (kind === "marketing") {
    if (!prefs?.marketingConsentAt) return false;
  } else if (!prefs?.transactionalConsentAt) {
    return false;
  }

  if (channel === "sms") return Boolean(prefs?.smsConsentAt);
  if (channel === "whatsapp") return Boolean(prefs?.whatsappConsentAt);
  if (channel === "email") return true;
  return false;
}

/** GDPR — STOP keyword instant unsubscribe. */
export async function processSmsStopUnsubscribe(
  admin: SupabaseClient,
  phoneE164: string
): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("guest_notification_preferences" as never)
    .update({
      unsubscribed_at: now,
      updated_at: now,
    } as never)
    .eq("phone_e164", phoneE164)
    .select("id");

  if (error) {
    logger.warn("processSmsStopUnsubscribe failed", { error: error.message });
    return 0;
  }

  return (data ?? []).length;
}

export function isStopKeyword(body: string): boolean {
  const normalized = body.trim().toUpperCase();
  return normalized === "STOP" || normalized === "UNSUBSCRIBE";
}

/** Auto-delete expired preference rows (GDPR retention). */
export async function purgeExpiredNotificationPreferences(
  admin: SupabaseClient,
  nowMs = Date.now()
): Promise<number> {
  const cutoff = new Date(nowMs).toISOString();
  const { data, error } = await admin
    .from("guest_notification_preferences" as never)
    .delete()
    .lt("retention_expires_at", cutoff)
    .select("id");

  if (error) {
    logger.warn("purgeExpiredNotificationPreferences failed", {
      error: error.message,
    });
    return 0;
  }

  return (data ?? []).length;
}

export async function logGuestNotificationSend(
  admin: SupabaseClient,
  input: {
    locationId: string;
    deviceFingerprint?: string | null;
    phoneE164?: string | null;
    channel: GuestNotificationChannel;
    kind: NotificationKind;
    templateId: string;
    body: string;
  }
): Promise<void> {
  await admin.from("guest_notification_log" as never).insert({
    location_id: input.locationId,
    device_fingerprint: input.deviceFingerprint ?? null,
    phone_e164: input.phoneE164 ?? null,
    channel: input.channel,
    kind: input.kind,
    template_id: input.templateId,
    body: input.body,
  } as never);
}
