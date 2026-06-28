import { pairingFor } from "@/lib/denis/kernel/vkg/queries";
import type { VenueKnowledgeGraph } from "@/lib/denis/kernel/vkg/types";
import { adaptSceneForAccessibility } from "@/lib/denis/intelligence/accessibility-adapter";
import type { GuestAccessibilityPrefs, SceneAccessibility } from "@/lib/denis/cognition/mental-model/accessibility-types";
import { filterEssentialSceneLayers } from "@/lib/denis/cognition/mental-model/derive-accessibility";
import { mergePaymentIntelligenceLayers } from "@/lib/scene/payment-intelligence-layers";
import { mergeTipIntelligenceLayers } from "@/lib/scene/tip-intelligence-layers";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";
import { resolvePhaseSceneChips } from "./resolve-table-actions";
import type { ComposeSceneInput, Scene, SceneLayer, SessionPhase } from "./types";
import { deriveSessionPhase as deriveSessionPhaseFromCommerce } from "@/lib/denis/loop/infer-session-phase";

export type SceneIntelligenceOrder = {
  id: string;
  status: string;
  createdAt: string;
  estimatedPrepMinutes: number | null;
};

export type VkgPairingMatch = {
  triggerName: string;
  productId: string;
  productName: string;
  priceCents?: number;
  reason?: string;
};

export type SceneIntelligenceContext = {
  enabled: boolean;
  phase: SessionPhase;
  language?: string;
  cartProductIds: string[];
  vkgGraph?: VenueKnowledgeGraph | null;
  vkgPairing?: VkgPairingMatch | null;
  orders?: SceneIntelligenceOrder[];
  hasUnpaidOrders?: boolean;
  slowKitchen?: boolean;
  nowMs?: number;
  /** Payment intelligence (Prompt 47). */
  amountDue?: number;
  partySize?: number;
  availableMethods?: SelectablePaymentMethod[];
  terminalEligible?: boolean;
  paymentDeclined?: boolean;
  paymentAtBarEnabled?: boolean;
  /** Smart tipping (Prompt 37). */
  smartTipOffer?: import("@/lib/denis/loop/view-types").SmartTipOffer | null;
};

const KITCHEN_WAIT_STATUSES = new Set([
  "pending",
  "confirmed",
  "accepted",
  "preparing",
]);

function resolveLang(language?: string): "sr" | "de" | "en" {
  const lang = (language ?? "sr").toLowerCase().slice(0, 2);
  if (lang === "de") return "de";
  if (lang === "en") return "en";
  return "sr";
}

function pairingBannerMessage(
  language: string | undefined,
  triggerName: string,
  productName: string
): string {
  const lang = resolveLang(language);
  if (lang === "de") {
    return `Zu Ihrem ${triggerName} passt ${productName}`;
  }
  if (lang === "en") {
    return `With your ${triggerName}, try ${productName}`;
  }
  return `Uz vaš ${triggerName} ide ${productName}`;
}

function slowKitchenBannerMessage(
  language: string | undefined,
  prepMinutes: number
): string {
  const lang = resolveLang(language);
  if (lang === "de") {
    return `Die Küche bereitet Ihre Bestellung vor — noch ~${prepMinutes} Min`;
  }
  if (lang === "en") {
    return `Kitchen is preparing your order — ~${prepMinutes} min left`;
  }
  return `Kuhinja priprema vašu narudžbinu — još ~${prepMinutes} min`;
}

function settlingBannerMessage(language?: string): string {
  const lang = resolveLang(language);
  if (lang === "de") {
    return "Alles da! Möchten Sie die Rechnung oder noch etwas?";
  }
  if (lang === "en") {
    return "Everything's here! Bill or something else?";
  }
  return "Sve je stiglo! Želite li račun ili još nešto?";
}

export function resolveVkgPairingForScene(input: {
  vkgGraph?: VenueKnowledgeGraph | null;
  cartProductIds: string[];
}): VkgPairingMatch | null {
  if (!input.vkgGraph || input.cartProductIds.length === 0) return null;

  const pairing = pairingFor(input.vkgGraph, input.cartProductIds, { limit: 1 })[0];
  if (!pairing) return null;

  const triggerProduct = input.cartProductIds
    .map((id) => input.vkgGraph!.products[id]?.name)
    .find(Boolean);

  return {
    triggerName: triggerProduct ?? "order",
    productId: pairing.productId,
    productName: pairing.name,
    priceCents: Math.round(pairing.price * 100),
    reason: pairing.reason,
  };
}

export function detectSlowKitchenForScene(input: {
  phase: SessionPhase;
  orders: SceneIntelligenceOrder[];
  nowMs?: number;
}): number | null {
  if (input.phase !== "waiting") return null;

  const nowMs = input.nowMs ?? Date.now();
  const waiting = input.orders.filter((order) =>
    KITCHEN_WAIT_STATUSES.has(order.status)
  );
  if (!waiting.length) return null;

  const slow = waiting.find((order) => {
    const waitMinutes = (nowMs - new Date(order.createdAt).getTime()) / 60_000;
    const threshold = order.estimatedPrepMinutes ?? 15;
    return waitMinutes >= Math.max(5, threshold * 0.6);
  });

  if (!slow) return null;

  const waitMinutes = (nowMs - new Date(slow.createdAt).getTime()) / 60_000;
  const eta = slow.estimatedPrepMinutes;
  if (eta != null && eta > 0) {
    return Math.max(1, Math.round(eta - waitMinutes));
  }
  return Math.max(1, Math.round((slow.estimatedPrepMinutes ?? 15) - waitMinutes));
}

export function deriveSceneIntelligenceBanners(
  ctx: SceneIntelligenceContext
): ComposeSceneInput["banners"] {
  if (!ctx.enabled) return [];

  const banners: ComposeSceneInput["banners"] = [];
  const pairing = ctx.vkgPairing ?? resolveVkgPairingForScene(ctx);

  if (ctx.phase === "ordering" && pairing) {
    banners.push({
      id: "vkg-pairing",
      message: pairingBannerMessage(
        ctx.language,
        pairing.triggerName,
        pairing.productName
      ),
      action: "add_product",
      productId: pairing.productId,
      productName: pairing.productName,
    });
  }

  const slowMinutes = ctx.slowKitchen
    ? detectSlowKitchenForScene({
        phase: ctx.phase,
        orders: ctx.orders ?? [],
        nowMs: ctx.nowMs,
      })
    : null;

  if (ctx.phase === "waiting" && slowMinutes != null) {
    banners.push({
      id: "slow-kitchen",
      message: slowKitchenBannerMessage(ctx.language, slowMinutes),
      action: "open_sheet",
    });
  }

  if (ctx.phase === "settling") {
    banners.push({
      id: "settling-ready",
      message: settlingBannerMessage(ctx.language),
      action: "view_bill",
    });
  }

  return banners;
}

export function deriveSceneIntelligenceInline(
  ctx: SceneIntelligenceContext
): ComposeSceneInput["inlineRecommendations"] {
  if (!ctx.enabled || ctx.phase !== "ordering") return [];

  const pairing = ctx.vkgPairing ?? resolveVkgPairingForScene(ctx);
  if (!pairing) return [];

  return [
    {
      productId: pairing.productId,
      name: pairing.productName,
      reason:
        pairing.reason ??
        pairingBannerMessage(ctx.language, pairing.triggerName, pairing.productName),
      priceCents: pairing.priceCents,
    },
  ];
}

/** Merge phase intelligence into compose input — chips, banners, inline (Prompt 31). */
export function enrichComposeSceneInput(
  input: ComposeSceneInput,
  ctx: SceneIntelligenceContext,
  accessibility?: GuestAccessibilityPrefs | null
): ComposeSceneInput {
  let next: ComposeSceneInput = { ...input };

  if (ctx.enabled) {
    const intelBanners = deriveSceneIntelligenceBanners(ctx);
    const existingIds = new Set(next.banners.map((banner) => banner.id));
    next = {
      ...next,
      banners: [
        ...next.banners,
        ...intelBanners.filter((banner) => !existingIds.has(banner.id)),
      ],
      inlineRecommendations:
        next.inlineRecommendations.length > 0
          ? next.inlineRecommendations
          : deriveSceneIntelligenceInline(ctx),
      chips:
        next.chips.length > 0
          ? next.chips
          : resolvePhaseSceneChips({
              phase: ctx.phase,
              language: ctx.language,
              hasUnpaidOrders: ctx.hasUnpaidOrders,
            }),
    };
  }

  if (accessibility) {
    next = adaptSceneForAccessibility(next, accessibility);
  }

  if (
    ctx.amountDue != null &&
    ctx.amountDue > 0 &&
    ctx.availableMethods?.length
  ) {
    next = mergePaymentIntelligenceLayers(next, {
      phase: ctx.phase,
      language: ctx.language,
      amountDue: ctx.amountDue,
      availableMethods: ctx.availableMethods,
      terminalEligible: ctx.terminalEligible,
      partySize: ctx.partySize,
      paymentDeclined: ctx.paymentDeclined,
      paymentAtBarEnabled: ctx.paymentAtBarEnabled,
    });
  }

  if (ctx.smartTipOffer) {
    next = mergeTipIntelligenceLayers(next, {
      phase: ctx.phase,
      language: ctx.language,
      offer: ctx.smartTipOffer,
    });
  }

  return next;
}

const LAYER_PRIORITY: Record<SceneLayer["kind"], number> = {
  blocking: 0,
  sheet: 1,
  banner: 2,
  inline: 3,
  chips: 4,
  ambient: 5,
};

export function deriveSessionPhase(input: {
  sessionClosed: boolean;
  hasOpenKitchenOrders: boolean;
  hasCartActivity: boolean;
  billSettled: boolean;
  allOrdersDelivered: boolean;
  orders?: import("@/lib/denis/loop/infer-session-phase").SessionPhaseOrder[];
  nowMs?: number;
}): SessionPhase {
  return deriveSessionPhaseFromCommerce(input);
}

/** Deterministic precedence — single place for guest UI structure (SC-1). */
export function composeScene(
  input: ComposeSceneInput,
  version = 1
): Scene {
  const layers: SceneLayer[] = [];

  if (input.blocking) {
    layers.push({
      kind: "blocking",
      reason: input.blocking.reason,
      message: input.blocking.message,
    });
  }

  const showSheet = input.sheetOpen || input.thinking;

  if (showSheet) {
    layers.push({
      kind: "sheet",
      open: input.sheetOpen,
      title: input.sheetTitle,
      thinking: input.thinking,
    });
  }

  for (const banner of input.banners) {
    layers.push({
      kind: "banner",
      id: banner.id,
      message: banner.message,
      action: banner.action,
      productId: banner.productId,
      productName: banner.productName,
      orderId: banner.orderId,
    });
  }

  for (const rec of input.inlineRecommendations) {
    layers.push({
      kind: "inline",
      productId: rec.productId,
      name: rec.name,
      reason: rec.reason,
      priceCents: rec.priceCents,
    });
  }

  if (input.chips.length > 0) {
    layers.push({ kind: "chips", options: input.chips });
  }

  if (input.denisActive) {
    layers.push({ kind: "ambient" });
  }

  layers.sort(
    (a, b) => LAYER_PRIORITY[a.kind] - LAYER_PRIORITY[b.kind]
  );

  const accessibilityPrefs =
    input.accessibility &&
    typeof input.accessibility === "object" &&
    "preferredMode" in input.accessibility
      ? (input.accessibility as GuestAccessibilityPrefs)
      : null;

  const filteredLayers = filterEssentialSceneLayers(layers, accessibilityPrefs);

  return {
    version,
    sessionId: input.sessionId,
    phase: input.phase,
    chrome: {
      tableName: input.tableName,
      venueName: input.venueName,
      markState: input.markState,
      denisActive: input.denisActive,
      situation: input.situation,
    },
    layers: filteredLayers,
    accessibility: input.accessibility ?? null,
  };
}
