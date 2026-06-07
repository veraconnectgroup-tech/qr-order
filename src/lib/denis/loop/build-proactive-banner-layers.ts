import { foldTranscriptFromTimeline } from "@/lib/denis/loop/fold-transcript";
import {
  shouldCommitProactiveToDock,
  type ProactiveNudgeKind,
} from "@/lib/denis/loop/proactive-dock-tell";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { SceneBannerAction } from "@/lib/scene/types";

const PROACTIVE_BANNER_KINDS = [
  "browse_nudge",
  "cart_recovery",
  "drink_pairing",
] as const satisfies readonly ProactiveNudgeKind[];

function isProactiveBannerKind(kind: string): kind is ProactiveNudgeKind {
  return (PROACTIVE_BANNER_KINDS as readonly string[]).includes(kind);
}

export type ProactiveBannerLayer = {
  id: string;
  message: string;
  action?: SceneBannerAction;
  productId?: string;
  productName?: string;
  orderId?: string;
  dismissKey: string;
};

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function proactiveDismissKey(kind: string, orderId?: string): string {
  return orderId ? `${kind}:${orderId}` : kind;
}

function proactiveBannerId(kind: string, orderId?: string): string {
  return orderId ? `proactive:${kind}:${orderId}` : `proactive:${kind}`;
}

/** Banner-only proactive emits → view.layers (GMM-13 / P5). Dock kinds excluded. */
export function buildProactiveBannerLayers(
  state: TableSessionState
): ProactiveBannerLayer[] {
  const dismissed = new Set(state.conversation.dismissedNudges);
  const transcriptTexts = new Set(
    foldTranscriptFromTimeline(state.timeline)
      .filter((entry) => entry.role === "denis")
      .map((entry) => entry.text.trim())
      .filter(Boolean)
  );

  const latestByKey = new Map<string, ProactiveBannerLayer>();

  for (const row of state.timeline) {
    if (row.event_type !== "proactive.emitted") continue;

    const payload = asRecord(row.payload);
    if (payload.type !== "proactive.emitted") continue;

    const kind = typeof payload.kind === "string" ? payload.kind.trim() : "";
    if (!kind || !isProactiveBannerKind(kind)) continue;
    if (shouldCommitProactiveToDock(kind)) continue;

    const orderId =
      typeof payload.orderId === "string" && payload.orderId.trim()
        ? payload.orderId.trim()
        : undefined;
    const dismissKey = proactiveDismissKey(kind, orderId);
    if (dismissed.has(dismissKey) || dismissed.has(kind)) continue;

    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    if (!message || transcriptTexts.has(message)) continue;

    const productId =
      typeof payload.productId === "string" && payload.productId.trim()
        ? payload.productId.trim()
        : undefined;
    const productName =
      typeof payload.productName === "string" ? payload.productName : undefined;

    latestByKey.set(dismissKey, {
      id: proactiveBannerId(kind, orderId),
      message,
      action: productId ? "add_product" : "open_sheet",
      productId,
      productName,
      orderId,
      dismissKey,
    });
  }

  return [...latestByKey.values()];
}

export function proactiveDismissKeyFromBannerId(bannerId: string): string | null {
  if (!bannerId.startsWith("proactive:")) return null;
  const rest = bannerId.slice("proactive:".length);
  const colonIndex = rest.indexOf(":");
  if (colonIndex < 0) return rest;
  const kind = rest.slice(0, colonIndex);
  const orderId = rest.slice(colonIndex + 1);
  return proactiveDismissKey(kind, orderId || undefined);
}
