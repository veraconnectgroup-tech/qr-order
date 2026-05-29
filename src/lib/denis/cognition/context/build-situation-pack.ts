import type { BeliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { getBeliefValue } from "@/lib/denis/cognition/beliefs/belief-types";
import { CORE_BELIEF_KEYS } from "@/lib/denis/cognition/beliefs/belief-types";
import { retrieveCommerceEvidence } from "@/lib/denis/cognition/context/retrievers/commerce-evidence";
import { buildDialogueFrameEvidence } from "@/lib/denis/cognition/context/retrievers/dialogue-frame";
import { retrieveGuestIntelEvidence } from "@/lib/denis/cognition/context/retrievers/guest-intel-evidence";
import { retrieveTranscriptWindowEvidence } from "@/lib/denis/cognition/context/retrievers/transcript-window";
import { retrieveVenueOpsEvidence } from "@/lib/denis/cognition/context/retrievers/venue-ops-evidence";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type { SessionPhase } from "@/lib/scene/types";
import type {
  OpsPlannerEffects,
  VenueOpsBeliefs,
} from "@/lib/denis/venue/ops/types";

type TranscriptMessage = {
  role: "user" | "assistant";
  content: string;
};

export type SituationPackInput = {
  state?: TableSessionState | null;
  beliefs: BeliefGraph;
  sessionPhase?: SessionPhase | null;
  flowNodeId?: FlowNodeId | null;
  transcript?: TranscriptMessage[];
  orderContext?: string | null;
  orderDraftContext?: string | null;
  guestMemory?: GuestMemoryProjection | null;
  venueOps?: VenueOpsBeliefs | null;
  opsEffects?: OpsPlannerEffects | null;
};

function buildProcessSection(input: SituationPackInput): string {
  const phase =
    input.sessionPhase ??
    inferPhaseFromState(input.state) ??
    "browsing";
  const flowNode =
    input.flowNodeId ?? input.state?.conversation.flowNodeId ?? "welcome";

  const lines = [
    "PROCESS:",
    `- session.phase: ${phase}`,
    `- flow_node: ${flowNode}`,
  ];

  const session = input.state?.session;
  if (session) {
    lines.push(`- session.status: ${session.status}`);
    lines.push(`- bill_settled: ${session.billSettled ? "yes" : "no"}`);
  }

  const table = input.state?.table;
  if (table?.name) {
    lines.push(`- table: ${table.name}`);
  }

  return lines.join("\n");
}

function inferPhaseFromState(
  state: TableSessionState | null | undefined
): SessionPhase | null {
  if (!state) return null;
  if (state.session.billSettled || state.session.accessState === "closed") {
    return "settling";
  }
  const openOrders = state.commerce.orders.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled"
  );
  if (openOrders.length > 0) {
    const kitchenOpen = openOrders.some((o) =>
      ["pending", "confirmed", "preparing", "ready"].includes(o.status)
    );
    if (kitchenOpen) return "waiting";
  }
  if (state.commerce.cart.visibleLines.length > 0) return "ordering";
  return "browsing";
}

function buildPartySection(state: TableSessionState | null | undefined): string {
  const party = state?.party;
  if (!party || party.activeDeviceCount <= 0) return "";

  return [
    "PARTY:",
    `- mode: ${party.partyMode}`,
    `- devices_at_table: ${party.activeDeviceCount}`,
    `- current_device_primary: ${party.isCurrentDevicePrimary ? "yes" : "no"}`,
  ].join("\n");
}

function buildPendingSlotHint(
  state: TableSessionState | null | undefined,
  beliefs: BeliefGraph
): string {
  const pendingSlot = getBeliefValue<string>(
    beliefs,
    CORE_BELIEF_KEYS.commercePendingSlot
  );
  if (!pendingSlot || !state) return "";

  const line = state.commerce.cart.visibleLines.find(
    (item) => !item.serveSize?.trim()
  );
  if (!line) {
    return `PENDING SLOT: awaiting ${pendingSlot} (guest must answer Denis last question)`;
  }

  return [
    "PENDING SLOT:",
    `- ${line.quantity}x ${line.productName} needs ${pendingSlot}`,
    "- Guest reply must fill this via proposedItems — do not re-ask the same question.",
  ].join("\n");
}

function buildPhaseBehaviorSection(input: SituationPackInput): string {
  const phase =
    input.sessionPhase ??
    inferPhaseFromState(input.state) ??
    "browsing";
  const flowNode =
    input.flowNodeId ?? input.state?.conversation.flowNodeId ?? "welcome";

  const lines = ["PHASE BEHAVIOR (follow this — do not reset thread):"];

  switch (phase) {
    case "browsing":
    case "latent":
      if (flowNode === "welcome") {
        lines.push(
          "- Welcome node: polite greeting (Dobar dan / Guten Tag), how may I help, soft 'have you decided?'. Warm — not pushy, no menu cards."
        );
      } else {
        lines.push(
          "- Guest may browse or start ordering. Polite and helpful; offer drink/food when relevant — never repetitive nudges."
        );
      }
      break;
    case "ordering":
      if (flowNode === "recap" || flowNode === "submit") {
        lines.push(
          "- Recap/confirm phase: guest may confirm (može, da, ajde) or add items. Do not restart welcome."
        );
      } else {
        lines.push(
          "- Active ordering: know the menu — vague category (pivo/beer) → name real items + size in one question. Ask each missing slot ONCE; combine when possible."
        );
      }
      break;
    case "waiting":
      lines.push(
        "- Orders in kitchen: answer status when asked. Do not push new menu items unless guest asks to order more."
      );
      break;
    case "settling":
      lines.push(
        "- Bill/payment phase: help with payment or handoff. Do not ask what they want to drink."
      );
      break;
    case "closed":
      lines.push("- Session closed: brief thanks only.");
      break;
    default:
      break;
  }

  return lines.join("\n");
}

/**
 * ADR-031 C1 — Unified Situation Pack for every LLM perceive turn.
 * Single truth block: process + dialogue + commerce + transcript + behavior.
 */
export function buildSituationPack(input: SituationPackInput): string {
  const blocks: string[] = [
    "SITUATION PACK (truth — do not contradict):",
    buildProcessSection(input),
    buildDialogueFrameEvidence({
      beliefs: input.beliefs,
      state: input.state,
    }),
  ];

  const commerce = retrieveCommerceEvidence(
    input.state,
    input.orderContext,
    input.orderDraftContext
  );
  if (commerce) blocks.push(commerce);

  const pendingHint = buildPendingSlotHint(input.state, input.beliefs);
  if (pendingHint && !input.orderDraftContext?.includes("PENDING ORDER ITEM")) {
    blocks.push(pendingHint);
  }

  const party = buildPartySection(input.state);
  if (party) blocks.push(party);

  const guestIntel = retrieveGuestIntelEvidence(input.guestMemory);
  if (guestIntel) blocks.push(guestIntel);

  const ops = retrieveVenueOpsEvidence(input.venueOps, input.opsEffects);
  if (ops) blocks.push(ops);

  const transcript = retrieveTranscriptWindowEvidence(input.transcript ?? []);
  if (transcript) blocks.push(transcript);

  blocks.push(buildPhaseBehaviorSection(input));

  return blocks.filter(Boolean).join("\n\n");
}
