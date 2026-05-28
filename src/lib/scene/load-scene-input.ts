import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveExperienceMoment } from "@/lib/commerce/experience/resolve-experience-moment";
import { loadEffectiveVenueOps } from "@/lib/denis/venue/ops";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import {
  AI_SHEET_ALLERGY_OPTIONS,
  AI_SHEET_MOOD_OPTIONS,
} from "@/lib/ai/guest-sheet-preferences";
import {
  deriveGuestSituation,
  situationSupportChips,
} from "./derive-guest-situation";
import { composeScene, deriveSessionPhase } from "./compose-scene";
import { extractPersistedSceneLayers } from "./extract-scene-layer-state";
import type { ComposeSceneInput, Scene } from "./types";

const KITCHEN_OPEN_STATUSES = new Set([
  "pending",
  "confirmed",
  "preparing",
  "ready",
]);

type LoadSceneOptions = {
  sheetOpen?: boolean;
  thinking?: boolean;
  markState?: ComposeSceneInput["markState"];
  proactiveBanner?: ComposeSceneInput["banners"][number] | null;
  chips?: ComposeSceneInput["chips"];
  inlineRecommendations?: ComposeSceneInput["inlineRecommendations"];
};

function defaultOnboardingChips(): ComposeSceneInput["chips"] {
  return [
    ...AI_SHEET_ALLERGY_OPTIONS.slice(0, 4).map((option) => ({
      id: `allergy-${option.id}`,
      label: option.label,
    })),
    ...AI_SHEET_MOOD_OPTIONS.slice(0, 2).map((option) => ({
      id: `mood-${option.id}`,
      label: option.label,
    })),
  ];
}

function resolveSceneChips(input: {
  override?: ComposeSceneInput["chips"];
  persisted: ComposeSceneInput["chips"];
  denisEnabled: boolean;
  denisActive: boolean;
  phase: ComposeSceneInput["phase"];
  situation: ComposeSceneInput["situation"];
}): ComposeSceneInput["chips"] {
  if (input.override?.length) return input.override;
  if (input.persisted.length) return input.persisted;

  if (
    input.situation?.hasActiveKitchen ||
    input.situation?.hasReadyOrder ||
    input.phase === "waiting"
  ) {
    return situationSupportChips().map((chip) => ({
      id: chip.id,
      label: chip.labelKey,
    }));
  }

  if (input.denisEnabled && !input.denisActive && input.phase === "browsing") {
    return defaultOnboardingChips();
  }
  return [];
}

function resolveInlineRecommendations(input: {
  override?: ComposeSceneInput["inlineRecommendations"];
  persisted: ComposeSceneInput["inlineRecommendations"];
}): ComposeSceneInput["inlineRecommendations"] {
  if (input.override?.length) return input.override;
  return input.persisted;
}

export async function loadComposeSceneInput(
  admin: SupabaseClient,
  sessionId: string,
  opts: LoadSceneOptions = {}
): Promise<ComposeSceneInput | null> {
  const { data: sessionRow, error: sessionError } = await admin
    .from("table_sessions")
    .select(
      `
      id,
      status,
      access_state,
      session_token,
      table_id,
      location_id,
      table:tables!inner(name),
      location:locations!inner(
        id,
        org_id,
        ai_concierge_enabled,
        organization:organizations!inner(name)
      )
    `
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !sessionRow) return null;

  const session = sessionRow as unknown as {
    id: string;
    status: string;
    access_state: string | null;
    session_token: string;
    table_id: string;
    location_id: string;
    table: { name: string };
    location: {
      id: string;
      org_id: string;
      ai_concierge_enabled: boolean;
      organization: { name: string };
    };
  };

  const locationId = session.location.id;
  const tableId = session.table_id;
  const denisEnabled = session.location.ai_concierge_enabled;

  const [{ data: commerceState }, { data: aiSessions }, { data: orders }] =
    await Promise.all([
      admin
        .from("guest_session_commerce_state" as never)
        .select("bill_settled, feedback_submitted")
        .eq("session_id", sessionId)
        .maybeSingle(),
      admin
        .from("ai_sessions")
        .select("id, status")
        .eq("session_token", session.session_token)
        .eq("table_id", tableId)
        .eq("status", "active")
        .limit(1),
      admin
        .from("orders")
        .select(
          `
          id,
          order_number,
          status,
          payment_status,
          estimated_prep_minutes,
          order_items (product_name, quantity)
        `
        )
        .eq("session_id", sessionId)
        .not("status", "in", '("rejected","cancelled")')
        .order("created_at", { ascending: true }),
    ]);

  const commerce = commerceState as {
    bill_settled?: boolean;
    feedback_submitted?: boolean;
  } | null;

  const orderRows = (orders ?? []) as Array<{
    id: string;
    order_number: number | null;
    status: string;
    payment_status: string;
    estimated_prep_minutes: number | null;
    order_items: Array<{ product_name: string; quantity: number }> | null;
  }>;

  const situation = deriveGuestSituation(orderRows);

  const hasOpenKitchenOrders = orderRows.some((o) =>
    KITCHEN_OPEN_STATUSES.has(o.status)
  );
  const allOrdersDelivered =
    orderRows.length > 0 && orderRows.every((o) => o.status === "delivered");
  const latestPaidOrder = [...orderRows].reverse().find(
    (o) => o.payment_status === "paid" || o.payment_status === "pos_online"
  );

  const phase = deriveSessionPhase({
    sessionClosed:
      session.status !== "active" ||
      session.access_state === "closed" ||
      session.access_state === "closing",
    hasOpenKitchenOrders,
    hasCartActivity: Boolean(aiSessions?.length),
    billSettled: Boolean(commerce?.bill_settled),
    allOrdersDelivered,
  });

  const denisActive = denisEnabled && Boolean(aiSessions?.length);

  const { data: existingSceneRow } = await admin
    .from("guest_scene" as never)
    .select("scene")
    .eq("session_id", sessionId)
    .maybeSingle();

  const persistedLayers = extractPersistedSceneLayers(
    (existingSceneRow as { scene?: Scene } | null)?.scene ?? null
  );

  const config = denisEnabled
    ? await loadConciergeConfigForLocation(locationId)
    : null;
  const { venueOps } = denisEnabled
    ? await loadEffectiveVenueOps(admin, {
        locationId,
        tableId,
        config: config!,
      })
    : { venueOps: null };

  const banners: ComposeSceneInput["banners"] = [];

  if (opts.proactiveBanner) {
    banners.push(opts.proactiveBanner);
  }

  if (
    situation?.hasReadyOrder &&
    !banners.some((b) => b.id === "order-ready")
  ) {
    banners.push({
      id: "order-ready",
      message: situation.headline,
      action: "open_sheet",
    });
  }

  if (venueOps?.staffHint?.visibility === "guest_safe" && venueOps.staffHint.text) {
    banners.push({
      id: "staff-hint",
      message: venueOps.staffHint.text,
      action: "open_sheet",
    });
  }

  if (
    venueOps?.kdsStress === "high" ||
    venueOps?.operatingMode === "rush"
  ) {
    banners.push({
      id: "venue-rush",
      message: "Kitchen is busy — we can suggest drinks while you wait.",
      action: "open_sheet",
    });
  }

  if (latestPaidOrder && commerce) {
    const moment = resolveExperienceMoment({
      paymentStatus: latestPaidOrder.payment_status,
      orderStatus: latestPaidOrder.status,
      sessionBillSettled: Boolean(commerce.bill_settled),
      allSessionOrdersDelivered: allOrdersDelivered,
      feedbackAlreadySubmitted: Boolean(commerce.feedback_submitted),
    });

    if (moment === "feedback_eligible") {
      banners.push({
        id: "feedback",
        message: "How was your visit?",
        action: "feedback",
      });
    }
  }

  return {
    sessionId,
    tableName: session.table.name,
    venueName: session.location.organization.name,
    phase,
    markState: opts.markState ?? "idle",
    denisActive,
    sheetOpen: opts.sheetOpen ?? false,
    sheetTitle: "Denis",
    thinking: opts.thinking ?? false,
    blocking: null,
    banners,
    inlineRecommendations: resolveInlineRecommendations({
      override: opts.inlineRecommendations,
      persisted: persistedLayers.inlineRecommendations,
    }),
    chips: resolveSceneChips({
      override: opts.chips,
      persisted: persistedLayers.chips,
      denisEnabled,
      denisActive,
      phase,
      situation,
    }),
    situation,
  };
}

export async function previewGuestScene(
  admin: SupabaseClient,
  sessionId: string,
  version: number,
  opts?: LoadSceneOptions
) {
  const input = await loadComposeSceneInput(admin, sessionId, opts);
  if (!input) return null;
  return composeScene(input, version);
}
