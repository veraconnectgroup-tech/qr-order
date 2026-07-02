import {
  commerceDenisWorldPayloadSchema,
  type CommerceDenisWorldPayload,
} from "@/lib/denis/ingress/world-types";
import { ensureSharedAiSessionForTableSession } from "@/lib/denis/loop/ensure-shared-ai-session";
import { persistTableSessionView } from "@/lib/denis/loop/persist-table-session-view";
import { persistWorldTell } from "@/lib/denis/loop/persist-world-tell";
import { notifyGuestSessionPush } from "@/lib/push/notify-guest-session";
import { loadAiSessionLocale } from "@/lib/denis/loop/resolve-ai-session-locale";
import { resolveWorldOrderTell } from "@/lib/denis/loop/tell-world-order";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import { logger } from "@/lib/logger";
import type { MenuLocale } from "@/lib/i18n/translations";
import { MENU_LOCALES } from "@/lib/i18n/translations";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseDenisWorldLocationRow } from "@/lib/supabase/parse-location-rows";
import type { SupabaseClient } from "@supabase/supabase-js";

async function loadWorldContext(
  admin: SupabaseClient,
  payload: CommerceDenisWorldPayload
) {
  const { data: locationRow } = await admin
    .from("locations")
    .select(
      "ai_concierge_enabled, menu_locale, default_locale, organization:organizations!inner(id, slug, name)"
    )
    .eq("id", payload.locationId)
    .maybeSingle();

  if (!locationRow) return null;

  const location = parseDenisWorldLocationRow(locationRow);

  if (!location.ai_concierge_enabled) return null;

  const rawLocale = location.default_locale ?? location.menu_locale ?? "de";
  const menuLocale = (
    MENU_LOCALES.includes(rawLocale as MenuLocale) ? rawLocale : "de"
  ) as MenuLocale;

  return {
    orgId: location.organization.id,
    orgSlug: location.organization.slug,
    venueName: location.organization.name,
    menuLocale,
    isEnglish: rawLocale === "en",
  };
}

/** ADR-019 Phase D — WORLD signal loop: FOLD context → TELL → PROJECT → notify. */
export async function runDenisWorldSignal(
  rawPayload: Record<string, unknown>
): Promise<void> {
  const parsed = commerceDenisWorldPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new Error("commerce.denis.world invalid payload");
  }

  const payload = parsed.data;
  const admin = createAdminClient();
  const ctx = await loadWorldContext(admin, payload);
  if (!ctx) return;

  const aiSessionId = await ensureSharedAiSessionForTableSession(admin, {
    sessionId: payload.sessionId,
    locationId: payload.locationId,
    tableId: payload.tableId,
    tableToken: payload.tableToken,
    orgId: ctx.orgId,
    language: ctx.menuLocale,
  });

  if (!aiSessionId) {
    logger.warn("runDenisWorldSignal: no ai session", {
      sessionId: payload.sessionId,
    });
    return;
  }

  const sessionLocale = await loadAiSessionLocale(
    admin,
    aiSessionId,
    ctx.menuLocale
  );

  const tell = resolveWorldOrderTell({
    signal: payload.signal,
    status: payload.status,
    previousStatus: payload.previousStatus,
    orderNumber: payload.orderNumber,
    menuLocale: sessionLocale.menuLocale,
    isEnglish: sessionLocale.isEnglish,
    stationTell: payload.stationTell,
    productTell: payload.productTell,
  });

  if (!tell) return;

  const traceId = createTurnTraceId();

  await persistWorldTell(admin, {
    aiSessionId,
    traceId,
    signal: payload.signal,
    orderId: payload.orderId,
    orderNumber: payload.orderNumber,
    status: payload.status,
    message: tell.message,
  });

  await persistTableSessionView(admin, {
    sessionId: payload.sessionId,
    tableId: payload.tableId,
    locationId: payload.locationId,
    tableToken: payload.tableToken,
    venueName: ctx.venueName,
    tellResult: {
      headline: tell.message,
      markState: tell.markState,
    },
  });

  const guestUrl = `/${ctx.orgSlug}/${payload.tableToken}`;

  if (tell.push) {
    await notifyGuestSessionPush(admin, {
      sessionId: payload.sessionId,
      pushType: "guest-order-ready",
      message: tell.message,
      title: ctx.venueName,
      url: guestUrl,
      orderNumber: payload.orderNumber,
      language: sessionLocale.menuLocale,
    });
  }
}
