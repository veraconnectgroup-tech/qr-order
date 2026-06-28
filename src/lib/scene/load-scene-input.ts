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
import { resolvePhaseSceneChips, resolveTableActionChips } from "./resolve-table-actions";
import { extractPersistedSceneLayers } from "./extract-scene-layer-state";
import {
  composeScene,
  deriveSessionPhase,
  enrichComposeSceneInput,
  type SceneIntelligenceContext,
} from "./compose-scene";
import { loadVenueKnowledgeGraph } from "@/lib/denis/kernel/vkg/load-graph";
import { initDraftFromStorage } from "@/lib/ai/ordering/draft-engine";
import type { ComposeSceneInput, Scene } from "./types";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import { getAvailablePaymentMethods } from "@/lib/payment-methods";
import { isTerminalPaymentEligible } from "@/lib/stripe/terminal-guest-copy";
import { parseComposeSceneSessionRow } from "@/lib/supabase/parse-session-rows";

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
  phase?: ComposeSceneInput["phase"];
  cartProductIds?: string[];
  sceneIntelligenceEnabled?: boolean;
  language?: string;
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
  hasUnpaidOrders: boolean;
  sceneIntelligenceEnabled: boolean;
  language?: string;
}): ComposeSceneInput["chips"] {
  if (input.override?.length) return input.override;
  if (input.persisted.length) return input.persisted;

  if (input.sceneIntelligenceEnabled) {
    return resolvePhaseSceneChips({
      phase: input.phase,
      language: input.language,
      hasUnpaidOrders: input.hasUnpaidOrders,
    });
  }

  const tableActions = resolveTableActionChips({
    phase: input.phase,
    hasUnpaidOrders: input.hasUnpaidOrders,
  }).map((chip) => ({ id: chip.id, label: chip.labelKey }));

  const situationChips =
    input.situation?.hasActiveKitchen ||
    input.situation?.hasReadyOrder ||
    input.phase === "waiting"
      ? situationSupportChips().map((chip) => ({
          id: chip.id,
          label: chip.labelKey,
        }))
      : [];

  const merged = [...tableActions, ...situationChips];
  if (merged.length) return merged;

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
        payment_online_enabled,
        payment_at_bar_enabled,
        payment_card_at_table_enabled,
        organization:organizations!inner(
          name,
          stripe_onboarded
        )
      )
    `
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !sessionRow) return null;

  const session = parseComposeSceneSessionRow(sessionRow);

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
        .select("id, status, order_draft")
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
          created_at,
          total,
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
    created_at: string;
    total: number;
    order_items: Array<{ product_name: string; quantity: number }> | null;
  }>;

  const amountDue = orderRows
    .filter((o) => !isPaidPaymentStatus(o.payment_status))
    .reduce((sum, o) => sum + Number(o.total), 0);

  const hasUnpaidOrders = amountDue > 0 || orderRows.some(
    (o) => !isPaidPaymentStatus(o.payment_status)
  );

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
  const { venueOps, opsEffects } = denisEnabled
    ? await loadEffectiveVenueOps(admin, {
        locationId,
        tableId,
        config: config!,
      })
    : { venueOps: null, opsEffects: null };

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

  if (opsEffects?.groupBillEnabled && !commerce?.bill_settled) {
    banners.push({
      id: "group-bill-split",
      message: "Grupni račun — podelite račun sa gostima za stolom.",
      action: "view_bill",
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

  const aiSessionRow = aiSessions?.[0] as
    | { order_draft?: unknown }
    | undefined;
  const draftItems = initDraftFromStorage(aiSessionRow?.order_draft ?? null).items;
  const cartProductIds =
    opts.cartProductIds ??
    draftItems
      .map((item) => item.productId)
      .filter((id): id is string => Boolean(id));

  const sceneIntelligenceEnabled =
    opts.sceneIntelligenceEnabled ?? !opsEffects?.skipUpsell;

  const baseInput: ComposeSceneInput = {
    sessionId,
    tableName: session.table.name,
    venueName: session.location.organization.name,
    phase: opts.phase ?? phase,
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
      phase: opts.phase ?? phase,
      situation,
      hasUnpaidOrders,
      sceneIntelligenceEnabled,
      language: opts.language,
    }),
    situation,
  };

  if (!sceneIntelligenceEnabled) {
    return baseInput;
  }

  const vkgGraph = denisEnabled
    ? await loadVenueKnowledgeGraph(locationId)
    : null;

  const locationRow = sessionRow as unknown as {
    location: {
      payment_online_enabled: boolean;
      payment_at_bar_enabled: boolean;
      payment_card_at_table_enabled: boolean;
      organization: { stripe_onboarded: boolean };
    };
  };

  const stripeOnboarded = Boolean(
    locationRow.location.organization.stripe_onboarded
  );
  const availableMethods = getAvailablePaymentMethods({
    stripeOnboarded,
    stripePublishableKey: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    paymentOnlineEnabled: locationRow.location.payment_online_enabled,
    paymentAtBarEnabled: locationRow.location.payment_at_bar_enabled,
    paymentCardAtTableEnabled: locationRow.location.payment_card_at_table_enabled,
  });

  const partySize = Math.max(
    opsEffects?.groupBillEnabled ? 2 : 0,
    aiSessions?.length ?? 0
  );

  const intelCtx: SceneIntelligenceContext = {
    enabled: true,
    phase: baseInput.phase,
    language: opts.language,
    cartProductIds,
    vkgGraph,
    orders: orderRows.map((order) => ({
      id: order.id,
      status: order.status,
      createdAt: order.created_at,
      estimatedPrepMinutes: order.estimated_prep_minutes,
    })),
    hasUnpaidOrders,
    slowKitchen: baseInput.phase === "waiting",
    amountDue: Math.round(amountDue * 100) / 100,
    partySize: partySize >= 2 ? partySize : undefined,
    availableMethods,
    terminalEligible: isTerminalPaymentEligible({
      stripeOnboarded,
      paymentCardAtTableEnabled:
        locationRow.location.payment_card_at_table_enabled,
    }),
    paymentAtBarEnabled: locationRow.location.payment_at_bar_enabled,
  };

  return enrichComposeSceneInput(baseInput, intelCtx);
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
