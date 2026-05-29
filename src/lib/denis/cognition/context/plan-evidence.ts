import type { BeliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { retrieveCommerceEvidence } from "@/lib/denis/cognition/context/retrievers/commerce-evidence";
import { buildDialogueFrameEvidence } from "@/lib/denis/cognition/context/retrievers/dialogue-frame";
import { retrieveGuestIntelEvidence } from "@/lib/denis/cognition/context/retrievers/guest-intel-evidence";
import {
  isMenuRagEnabled,
  retrieveMenuEvidence,
} from "@/lib/denis/cognition/context/retrievers/menu-rag";
import type { MenuRagCatalog } from "@/lib/denis/cognition/context/menu-rag-types";
import { retrieveTranscriptWindowEvidence } from "@/lib/denis/cognition/context/retrievers/transcript-window";
import { retrieveVenueOpsEvidence } from "@/lib/denis/cognition/context/retrievers/venue-ops-evidence";
import type { VenueManifestCapabilities } from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import type { DenisRuntimeResolvedProfile } from "@/lib/denis/cognition/runtime-profile-types";
import type { TurnPlan } from "@/lib/denis/cognition/tde/turn-plan-types";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type {
  OpsPlannerEffects,
  VenueOpsBeliefs,
} from "@/lib/denis/venue/ops/types";

export type EvidencePointer =
  | "commerce.*"
  | "transcript.window"
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
  beliefs: BeliefGraph;
  capabilities: VenueManifestCapabilities;
  profile: DenisRuntimeResolvedProfile;
  guestMessage: string;
  state?: TableSessionState | null;
  transcript?: TranscriptMessage[];
  guestMemory?: GuestMemoryProjection | null;
  venueOps?: VenueOpsBeliefs | null;
  opsEffects?: OpsPlannerEffects | null;
  orderContext?: string | null;
  orderDraftContext?: string | null;
  catalog?: MenuRagCatalog | null;
  playbookBlock?: string | null;
};

function wantsCatalogRag(turnPlan: TurnPlan, message: string): boolean {
  if (turnPlan.kind === "transactional_perceive") return true;
  if (turnPlan.kind === "relational_perceive") {
    return /\b(preporu[čc]|empfehl|recommend|suggest|meni|menu|bez|gluten)\b/i.test(
      message
    );
  }
  return false;
}

/**
 * ADR-023 §7 — deterministic evidence pointers for perceive prompt.
 */
export function planEvidence(input: PlanEvidenceInput): TurnEvidencePack {
  const pointers: EvidencePointer[] = ["commerce.*", "transcript.window"];
  const blocks: string[] = [];

  const commerce = retrieveCommerceEvidence(
    input.state,
    input.orderContext,
    input.orderDraftContext
  );
  if (commerce) blocks.push(commerce);

  if (input.turnPlan.requiresLlm) {
    pointers.push("dialogue.frame");
    blocks.push(
      buildDialogueFrameEvidence({
        beliefs: input.beliefs,
        state: input.state,
      })
    );
  }

  const transcript = retrieveTranscriptWindowEvidence(input.transcript ?? []);
  if (transcript) blocks.push(transcript);

  if (input.capabilities.guestMemory >= 2) {
    pointers.push("guest.memory");
    const guestIntel = retrieveGuestIntelEvidence(input.guestMemory);
    if (guestIntel) blocks.push(guestIntel);
  }

  if (input.capabilities.anticipation >= 1 || input.capabilities.transactional >= 1) {
    pointers.push("venue.ops");
    const ops = retrieveVenueOpsEvidence(input.venueOps, input.opsEffects);
    if (ops) blocks.push(ops);
  }

  let omitFullMenu = false;
  const ragEligible =
    wantsCatalogRag(input.turnPlan, input.guestMessage) &&
    isMenuRagEnabled({
      catalogRagLevel: input.capabilities.catalogRag,
      menuRagEnabled: input.profile.menuRagEnabled,
    });

  if (ragEligible && input.catalog && Object.keys(input.catalog).length > 0) {
    pointers.push("catalog.rag");
    const rag = retrieveMenuEvidence(input.guestMessage, input.catalog);
    if (rag.snippet) {
      blocks.push(`CATALOG RAG (product IDs are truth):\n${rag.snippet}`);
      omitFullMenu = true;
    }
  }

  const includePlaybook =
    input.turnPlan.requiresLlm &&
    (input.turnPlan.kind === "transactional_perceive" ||
      input.turnPlan.kind === "relational_perceive" ||
      input.turnPlan.kind === "narrate_paraphrase");

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
    input.turnPlan.kind === "relational_perceive" &&
    !ragEligible
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
