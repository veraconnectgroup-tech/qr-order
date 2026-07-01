import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { loadWaitlistFloorSnapshot } from "@/lib/denis/commerce/load-waitlist-floor-snapshot";
import { loadLoyaltyProfile } from "@/lib/denis/commerce/loyalty/loyalty-store";
import {
  assignWaitlistPosition,
  buildTableReadyNotification,
  buildWaitlistJoinMessage,
  buildWaitlistProactiveMessage,
  canJoinWaitlist,
  DEFAULT_WAITLIST_CONFIG,
  estimateWaitTimeSmart,
  guestCancelWaitlistEntry,
  pickNextWaitingEntry,
  reorderWaitlistQueue,
  resolveNoShowEntries,
  resolveWaitlistPriority,
  formatWaitlistStaffView,
  type WaitlistEntry,
} from "@/lib/denis/commerce/waitlist";
import {
  appendWaitlistEntry,
  loadWaitlistEntries,
  updateWaitlistEntries,
} from "@/lib/denis/commerce/waitlist-store";
import {
  saveWaitlistPushSubscription,
  type WaitlistPushSubscription,
} from "@/lib/denis/commerce/waitlist-push-store";
import { routeGuestNotification } from "@/lib/notifications/channel-router";
import { upsertGuestNotificationPreferences } from "@/lib/notifications/guest-preferences";
import { buildWaitlistTableReadySms } from "@/lib/notifications/templates";
import { withRateLimit } from "@/lib/rate-limit";
import { zSanitizedText, zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const joinSchema = z.object({
  locationId: zUuid(),
  guestName: zSanitizedText(80).refine((value) => value.length > 0, "Name required"),
  partySize: z.number().int().min(1).max(8),
  deviceFingerprint: z.string().min(8).max(128),
  language: z.string().max(10).optional(),
  priorityBoost: z.number().int().min(0).max(5).optional(),
  isReturningGuest: z.boolean().optional(),
  pushSubscription: pushSubscriptionSchema.optional(),
  phoneE164: z.string().trim().min(8).max(20).optional(),
  preferredChannel: z.enum(["push", "whatsapp", "sms", "email"]).optional(),
  smsConsent: z.boolean().optional(),
  whatsappConsent: z.boolean().optional(),
  transactionalConsent: z.boolean().optional(),
});

const cancelSchema = z.object({
  locationId: zUuid(),
  entryId: z.string().uuid(),
  deviceFingerprint: z.string().min(8).max(128),
});

async function persistAndResolveQueue(locationId: string) {
  return updateWaitlistEntries(locationId, (entries) =>
    resolveNoShowEntries(entries, DEFAULT_WAITLIST_CONFIG)
  );
}

export const GET = withErrorHandler("commerce-waitlist-get", async (req) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return apiError("locationId required.", 400);
  }

  const entryId = req.nextUrl.searchParams.get("entryId");
  const deviceFingerprint = req.nextUrl.searchParams.get("deviceFingerprint");
  const language = req.nextUrl.searchParams.get("language") ?? "sr";

  const admin = createAdminClient();
  const floor = await loadWaitlistFloorSnapshot(
    admin,
    locationId,
    DEFAULT_WAITLIST_CONFIG.avgTurnoverMinutes
  );

  const entries = await persistAndResolveQueue(locationId);
  const active = entries.filter(
    (entry) => entry.status === "waiting" || entry.status === "notified"
  );

  if (entryId && deviceFingerprint) {
    const entry = entries.find((row) => row.id === entryId);
    if (!entry || entry.deviceFingerprint !== deviceFingerprint) {
      return apiError("Entry not found.", 404);
    }

    const position = assignWaitlistPosition(entries, entry.id);
    const estimatedWaitMinutes = estimateWaitTimeSmart({
      position,
      floor,
    });
    const joined = new Date(entry.joinedAt).getTime();
    const waitedMinutes = Number.isNaN(joined)
      ? 0
      : Math.max(0, Math.round((Date.now() - joined) / 60_000));

    return apiSuccess({
      entry,
      position,
      estimatedWaitMinutes,
      proactiveMessage: buildWaitlistProactiveMessage({
        waitedMinutes,
        estimatedMinutes: estimatedWaitMinutes,
        language,
      }),
      notifyMessage:
        entry.status === "notified"
          ? buildTableReadyNotification({
              guestName: entry.guestName,
              timeoutMinutes: DEFAULT_WAITLIST_CONFIG.noShowTimeoutMinutes,
              language,
            })
          : null,
      config: DEFAULT_WAITLIST_CONFIG,
    });
  }

  return apiSuccess({
    entries: active,
    rows: formatWaitlistStaffView(
      entries,
      DEFAULT_WAITLIST_CONFIG,
      floor
    ),
    queueLength: active.length,
    config: DEFAULT_WAITLIST_CONFIG,
    floor,
  });
});

export const POST = withErrorHandler("commerce-waitlist-post", async (req) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const parsed = joinSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const { locationId, guestName, partySize, deviceFingerprint } = parsed.data;
  const admin = createAdminClient();
  const floor = await loadWaitlistFloorSnapshot(
    admin,
    locationId,
    DEFAULT_WAITLIST_CONFIG.avgTurnoverMinutes
  );

  const queue = await loadWaitlistEntries(locationId);
  const active = queue.filter(
    (entry) => entry.status === "waiting" || entry.status === "notified"
  );

  const admission = canJoinWaitlist({
    queueLength: active.length,
    config: DEFAULT_WAITLIST_CONFIG,
  });
  if (!admission.allowed) {
    return apiError("Waitlist is full.", 403, { code: admission.reason });
  }

  const loyalty = await loadLoyaltyProfile(admin, locationId, deviceFingerprint);
  const priority = resolveWaitlistPriority({
    explicitBoost: parsed.data.priorityBoost,
    loyaltyBoost: loyalty?.waitlistPriorityBoost,
    isReturningGuest:
      parsed.data.isReturningGuest ?? (loyalty?.visitCount ?? 0) > 1,
  });

  if (parsed.data.pushSubscription) {
    await saveWaitlistPushSubscription(
      locationId,
      deviceFingerprint,
      parsed.data.pushSubscription as WaitlistPushSubscription
    );
  }

  if (parsed.data.phoneE164 || parsed.data.smsConsent || parsed.data.whatsappConsent) {
    await upsertGuestNotificationPreferences(admin, {
      locationId,
      deviceFingerprint,
      phoneE164: parsed.data.phoneE164,
      preferredChannel: parsed.data.preferredChannel,
      smsConsent: parsed.data.smsConsent,
      whatsappConsent: parsed.data.whatsappConsent,
      transactionalConsent: parsed.data.transactionalConsent ?? Boolean(parsed.data.phoneE164),
    });
  }

  const position = active.length + 1;
  const estimatedWaitMinutes = estimateWaitTimeSmart({ position, floor });

  const entry: WaitlistEntry = {
    id: crypto.randomUUID(),
    guestName,
    partySize,
    joinedAt: new Date().toISOString(),
    estimatedWaitMinutes,
    status: "waiting",
    notifiedAt: null,
    deviceFingerprint,
    priorityBoost: priority.priorityBoost,
    isReturningGuest: priority.isReturningGuest,
  };

  await appendWaitlistEntry(locationId, entry);

  return apiSuccess({
    entry,
    position: assignWaitlistPosition([...active, entry], entry.id),
    message: buildWaitlistJoinMessage({
      guestName,
      partySize,
      estimatedMinutes: estimatedWaitMinutes,
      language: parsed.data.language,
    }),
  });
});

export const DELETE = withErrorHandler("commerce-waitlist-delete", async (req) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const parsed = cancelSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const updated = await updateWaitlistEntries(
    parsed.data.locationId,
    (entries) =>
      guestCancelWaitlistEntry(
        entries,
        parsed.data.entryId,
        parsed.data.deviceFingerprint
      )
  );

  const entry = updated.find((row) => row.id === parsed.data.entryId);
  if (entry?.status !== "cancelled") {
    return apiError("Could not cancel entry.", 403);
  }

  return apiSuccess({ cancelled: true });
});

/** Staff: notify / seat / skip / reorder queue. */
export const PATCH = withErrorHandler("commerce-waitlist-patch", async (req) => {
  const limited = await withRateLimit(req, "sessions");
  if (limited) return limited;

  const body = (await req.json()) as {
    locationId?: string;
    entryId?: string;
    action?: "notify" | "seat" | "no_show" | "reorder";
    orderedEntryIds?: string[];
    slug?: string;
    language?: string;
  };

  if (!body.locationId || !body.action) {
    return apiError("Invalid input.", 400);
  }

  if (body.action === "reorder") {
    if (!body.orderedEntryIds?.length) {
      return apiError("orderedEntryIds required.", 400);
    }
    const updated = await updateWaitlistEntries(body.locationId, (entries) =>
      reorderWaitlistQueue(entries, body.orderedEntryIds!)
    );
    return apiSuccess({ entries: updated });
  }

  if (!body.entryId) {
    return apiError("entryId required.", 400);
  }

  const updated = await updateWaitlistEntries(body.locationId, (entries) =>
    entries.map((entry) => {
      if (entry.id !== body.entryId) return entry;
      if (body.action === "notify") {
        return {
          ...entry,
          status: "notified" as const,
          notifiedAt: new Date().toISOString(),
        };
      }
      if (body.action === "seat") {
        return { ...entry, status: "seated" as const };
      }
      if (body.action === "no_show") {
        return { ...entry, status: "no_show" as const };
      }
      return entry;
    })
  );

  const entry = updated.find((row) => row.id === body.entryId);
  const notifyMessage =
    body.action === "notify" && entry
      ? buildTableReadyNotification({
          guestName: entry.guestName,
          timeoutMinutes: DEFAULT_WAITLIST_CONFIG.noShowTimeoutMinutes,
          language: body.language,
        })
      : null;

  if (body.action === "notify" && entry && notifyMessage) {
    const waitlistUrl = body.slug
      ? `/${body.slug}/waitlist`
      : "/waitlist";

    const smsMessage = buildWaitlistTableReadySms({
      timeoutMinutes: DEFAULT_WAITLIST_CONFIG.noShowTimeoutMinutes,
      language: body.language,
    });

    const admin = createAdminClient();
    await routeGuestNotification(admin, {
      locationId: body.locationId,
      deviceFingerprint: entry.deviceFingerprint,
      kind: "transactional",
      templateId: "waitlist.table_ready",
      message: smsMessage,
      title: "Vaš sto je spreman!",
      url: waitlistUrl,
      pushAvailable: true,
    });
  }

  const nextWaiting =
    body.action === "no_show" ? pickNextWaitingEntry(updated) : null;

  return apiSuccess({ entry, notifyMessage, nextWaiting });
});
