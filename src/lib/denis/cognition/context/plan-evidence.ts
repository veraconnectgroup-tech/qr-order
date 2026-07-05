import type { BeliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { resolveAdaptiveContextBudget } from "@/lib/denis/cognition/context/context-budget";
import { retrieveCommerceEvidence } from "@/lib/denis/cognition/context/retrievers/commerce-evidence";
import { retrieveGuestIntelEvidence } from "@/lib/denis/cognition/context/retrievers/guest-intel-evidence";
import {
  isMenuRagEnabled,
  retrieveMenuEvidence,
} from "@/lib/denis/cognition/context/retrievers/menu-rag";
import type { MenuRagCatalog, MenuRagEmbeddingIndex } from "@/lib/denis/cognition/context/menu-rag-types";
import { buildOrderComprehendHint } from "@/lib/ai/ordering/category-order-logic";
import { retrieveTranscriptWindowEvidence } from "@/lib/denis/cognition/context/retrievers/transcript-window";
import { retrieveVenueOpsEvidence } from "@/lib/denis/cognition/context/retrievers/venue-ops-evidence";
import type { VenueManifestCapabilities } from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import type { DenisRuntimeResolvedProfile } from "@/lib/denis/cognition/runtime-profile-types";
import type { InterpretationTask } from "@/lib/denis/cognition/tde/interpretation-task-types";
import type { TurnPlan } from "@/lib/denis/cognition/tde/turn-plan-types";
import {
  CORE_BELIEF_KEYS,
  getBeliefValue,
} from "@/lib/denis/cognition/tde/turn-plan-types";
import { classifyGuestIntent } from "@/lib/denis/cognition/tde/semantic-intent-router";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type { ResolvedRhythmContext } from "@/lib/denis/config/rhythm-prior-types";
import type { SessionPhase } from "@/lib/scene/types";
import type {
  OpsPlannerEffects,
  VenueOpsBeliefs,
} from "@/lib/denis/venue/ops/types";
import type { ContextAwarenessSnapshot } from "@/lib/denis/intelligence/event-context";

export type EvidencePointer =
  | "commerce.*"
  | "commerce.status"
  | "transcript.window"
  | "situation.pack"
  | "dialogue.frame"
  | "guest.memory"
  | "venue.ops"
  | "catalog.rag"
  | "playbook.examples";

export type TurnEvidencePack = {
  pointers: EvidencePointer[];
  /** Combined evidence block appended before menu section. */
  evidenceBlock: string;
  /** When true, perceive uses RAG/snippet instead of full menu text. */
  omitFullMenu: boolean;
  playbookBlock: string | null;
};

type TranscriptMessage = {
  role: "user" | "assistant";
  content: string;
};

export type PlanEvidenceInput = {
  turnPlan: TurnPlan;
  /** L3 goal-directed evidence budget (ARCH-7 / C12). */
  interpretationTask?: InterpretationTask | null;
  beliefs: BeliefGraph;
  capabilities: VenueManifestCapabilities;
  profile: DenisRuntimeResolvedProfile;
  guestMessage: string;
  state?: TableSessionState | null;
  sessionPhase?: SessionPhase | null;
  flowNodeId?: FlowNodeId | null;
  transcript?: TranscriptMessage[];
  guestMemory?: GuestMemoryProjection | null;
  venueOps?: VenueOpsBeliefs | null;
  opsEffects?: OpsPlannerEffects | null;
  orderContext?: string | null;
  orderDraftContext?: string | null;
  catalog?: MenuRagCatalog | null;
  menuRagEmbeddings?: MenuRagEmbeddingIndex | null;
  menuRagQueryVector?: number[] | null;
  playbookBlock?: string | null;
  vkgPairingBlock?: string | null;
  frustrationRecoveryBlock?: string | null;
  rhythm?: ResolvedRhythmContext | null;
  revenueInsight?: unknown;
  accessibilityBlock?: string | null;
  promoBlock?: string | null;
  crossDeviceBlock?: string | null;
  contextAwareness?: ContextAwarenessSnapshot | null;
  guestStatusSection?: string | null;
};

export function guestTurnNeedsMenuContext(
  turnPlan: TurnPlan,
  message: string,
  interpretationTask?: InterpretationTask | null,
  beliefs?: BeliefGraph
): boolean {
  if (interpretationTask?.evidenceBudget.includeCatalogRag) return true;
  if (turnPlan.kind === "transactional_perceive") return true;
  if (turnPlan.reason?.startsWith("vague_recommend")) return true;
  if (turnPlan.reason === "mental.attention_empathy") return true;

  const trimmed = message.trim();
  if (!trimmed) return false;

  const routed = classifyGuestIntent(trimmed);
  if (routed.intent === "browse" || routed.intent === "order") return true;

  if (beliefs) {
    const need = getBeliefValue<string>(
      beliefs,
      CORE_BELIEF_KEYS.mentalPredictedNeed
    );
    if (need === "wants_drink" || need === "needs_help_choosing") {
      return true;
    }
  }

  return /\b(sta\s+je|šta\s+je|kakv[oa]\s+je|what\s+is|what\s+kind|objasni|explain)\b/i.test(
    trimmed
  );
}

function wantsCatalogRag(
  turnPlan: TurnPlan,
  message: string,
  interpretationTask?: InterpretationTask | null,
  beliefs?: BeliefGraph
): boolean {
  return guestTurnNeedsMenuContext(
    turnPlan,
    message,
    interpretationTask,
    beliefs
  );
}

/**
 * ADR-023 §7 — deterministic evidence pointers for perceive prompt.
 */
export function planEvidence(input: PlanEvidenceInput): TurnEvidencePack {
  const pointers: EvidencePointer[] = ["commerce.*", "transcript.window"];
  const blocks: string[] = [];

  if (input.turnPlan.requiresLlm) {
    pointers.push("situation.pack");
    if (input.interpretationTask?.directiveBlock) {
      blocks.push(input.interpretationTask.directiveBlock);
    }
    const includePlaybookInFsp =
      input.interpretationTask?.evidenceBudget.includePlaybook ??
      (input.turnPlan.kind === "transactional_perceive" ||
        input.turnPlan.kind === "relational_perceive" ||
        input.turnPlan.kind === "narrate_paraphrase");

    blocks.push(
      buildSituationPack({
        state: input.state,
        beliefs: input.beliefs,
        sessionPhase: input.sessionPhase,
        flowNodeId: input.flowNodeId,
        transcript: input.transcript,
        orderContext: input.orderContext,
        orderDraftContext: input.orderDraftContext,
        guestMemory: input.guestMemory,
        venueOps: input.venueOps,
        opsEffects: input.opsEffects,
        vkgPairingBlock: input.vkgPairingBlock,
        playbookBlock:
          includePlaybookInFsp && input.playbookBlock?.trim()
            ? input.playbookBlock
            : null,
        contextTokenBudget: input.profile.adaptiveContext
          ? (input.interpretationTask?.evidenceBudget.contextTokenBudget ??
            resolveAdaptiveContextBudget({
              guestMessage: input.guestMessage,
              maxContextTokens: input.profile.maxContextTokens,
              minContextTokens: input.profile.minContextTokens,
              adaptiveEnabled: input.profile.adaptiveContext,
              beliefs: input.beliefs,
            }).tokenBudget)
          : undefined,
        guestMessage: input.guestMessage,
        contextAwareness: input.contextAwareness,
      })
    );

    if (input.catalog && Object.keys(input.catalog).length > 0) {
      const comprehendHint = buildOrderComprehendHint(
        input.guestMessage,
        input.catalog
      );
      if (comprehendHint) blocks.push(comprehendHint);
    }

    if (
      guestTurnNeedsMenuContext(
        input.turnPlan,
        input.guestMessage,
        input.interpretationTask,
        input.beliefs
      )
    ) {
      blocks.push(
        "MENU DISCOVERY: Guest asks what is available — answer from MENU/CATALOG with concrete items and prices. Do not notify the waiter unless they explicitly request staff."
      );
    }
  } else {
    const commerce = retrieveCommerceEvidence(
      input.state,
      input.orderContext,
      input.orderDraftContext
    );
    if (commerce) blocks.push(commerce);

    const transcript = retrieveTranscriptWindowEvidence(input.transcript ?? []);
    if (transcript) blocks.push(transcript);
  }

  const guestMemoryEligible =
    input.guestMemory &&
    input.capabilities.guestMemory >= 1 &&
    !blocks.some((block) => block.includes("GUEST MEMORY"));

  if (guestMemoryEligible) {
    pointers.push("guest.memory");
    const guestIntel = retrieveGuestIntelEvidence(input.guestMemory);
    if (guestIntel) blocks.push(guestIntel);
  }

  if (input.frustrationRecoveryBlock?.trim()) {
    blocks.push(input.frustrationRecoveryBlock.trim());
  }

  if (input.guestStatusSection?.trim()) {
    pointers.push("commerce.status");
    blocks.push(input.guestStatusSection.trim());
  }

  if (input.promoBlock?.trim()) {
    blocks.push(input.promoBlock.trim());
  }

  if (input.crossDeviceBlock?.trim()) {
    blocks.push(input.crossDeviceBlock.trim());
  }

  if (input.accessibilityBlock?.trim()) {
    blocks.push(input.accessibilityBlock.trim());
  }

  if (
    !input.turnPlan.requiresLlm &&
    (input.capabilities.anticipation >= 1 ||
      input.capabilities.transactional >= 1)
  ) {
    pointers.push("venue.ops");
    const ops = retrieveVenueOpsEvidence(input.venueOps, input.opsEffects);
    if (ops) blocks.push(ops);
  }

  let omitFullMenu = false;
  const ragEligible =
    wantsCatalogRag(
      input.turnPlan,
      input.guestMessage,
      input.interpretationTask,
      input.beliefs
    ) &&
    isMenuRagEnabled({
      catalogRagLevel: input.capabilities.catalogRag,
      menuRagEnabled: input.profile.menuRagEnabled,
    });

  if (ragEligible && input.catalog && Object.keys(input.catalog).length > 0) {
    pointers.push("catalog.rag");
    const rag = retrieveMenuEvidence(input.guestMessage, input.catalog, {
      embeddings: input.menuRagEmbeddings ?? undefined,
      queryVector: input.menuRagQueryVector ?? undefined,
    });
    if (rag.snippet) {
      blocks.push(`CATALOG RAG (product IDs are truth):\n${rag.snippet}`);
      omitFullMenu = true;
    }
  }

  const defaultPlaybookKinds =
    input.turnPlan.kind === "transactional_perceive" ||
    input.turnPlan.kind === "relational_perceive" ||
    input.turnPlan.kind === "narrate_paraphrase";
  const includePlaybook =
    input.turnPlan.requiresLlm &&
    (input.interpretationTask?.evidenceBudget.includePlaybook ??
      defaultPlaybookKinds);

  let playbookBlock: string | null = null;
  if (includePlaybook && input.playbookBlock?.trim()) {
    pointers.push("playbook.examples");
    playbookBlock = input.playbookBlock.trim();
  }

  if (
    input.turnPlan.kind === "template_tell" ||
    input.turnPlan.kind === "slot_extract" ||
    input.turnPlan.kind === "reflex_only"
  ) {
    omitFullMenu = true;
  }

  if (
    input.interpretationTask?.evidenceBudget.omitFullMenuWhenNoRag &&
    !ragEligible
  ) {
    omitFullMenu = true;
  } else if (
    input.turnPlan.kind === "relational_perceive" &&
    !ragEligible &&
    !input.interpretationTask &&
    !guestTurnNeedsMenuContext(
      input.turnPlan,
      input.guestMessage,
      input.interpretationTask,
      input.beliefs
    )
  ) {
    omitFullMenu = true;
  }

  return {
    pointers,
    evidenceBlock: blocks.filter(Boolean).join("\n\n"),
    omitFullMenu,
    playbookBlock,
  };
}
