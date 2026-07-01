import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { planEvidence } from "@/lib/denis/cognition/context/plan-evidence";
import { beliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { mergeManifestConfig } from "@/lib/denis/cognition/manifest/merge-manifest-config";
import {
  formatPlaybookPackBlock,
  previewPlaybookPackTurn,
  resolvePlaybookPackId,
} from "@/lib/denis/cognition/manifest/resolve-playbook-pack";
import { parseVenueManifest } from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { TurnPlan } from "@/lib/denis/cognition/tde/turn-plan-types";
import { DENIS_TIER_DEFAULTS } from "@/lib/denis/cognition/tier-defaults";
import type { DenisRuntimeResolvedProfile } from "@/lib/denis/cognition/runtime-profile-types";

export type PlaybookPackFixtureResult = {
  passed: boolean;
  errors: string[];
};

const OPEN_CAPABILITIES = {
  relational: 4,
  transactional: 4,
  catalogRag: 4,
  guestMemory: 4,
  anticipation: 4,
} as const;

function orgManifestWithPack(packId: string) {
  return {
    manifest_version: 1,
    playbook_pack_id: packId,
    capabilities: OPEN_CAPABILITIES,
  };
}

function locationManifestWithPack(packId: string) {
  return orgManifestWithPack(packId);
}

const relationalTurnPlan: TurnPlan = {
  kind: "relational_perceive",
  requiresLlm: true,
  suppressUpsell: false,
  reason: "conversation.banter",
};

const eliteProfile: DenisRuntimeResolvedProfile = {
  tier: "elite",
  perceivePipeline: "split",
  menuRagEnabled: true,
  models: DENIS_TIER_DEFAULTS.elite.models,
  maxContextTokens: 4000,
  adaptiveContext: true,
  minContextTokens: 500,
};

/** MR-9 / Prompt 36 — pack tone must differ; formal vs casual burger order. */
export function runPlaybookPackFixture(): PlaybookPackFixtureResult {
  const errors: string[] = [];

  const formalOrg = parseVenueManifest(orgManifestWithPack("formal-de"));
  const casualLocation = parseVenueManifest(locationManifestWithPack("casual-de"));
  const hqOrg = parseVenueManifest(orgManifestWithPack("formal-de"));

  const locationWins = resolvePlaybookPackId(hqOrg, casualLocation);
  if (locationWins !== "casual-de") {
    errors.push(`location pack should override org, got ${locationWins ?? "null"}`);
  }

  const skylineOrg = parseVenueManifest(orgManifestWithPack("skyline"));
  const chainOrg = parseVenueManifest(orgManifestWithPack("generic-chain"));

  const formalBlock = formatPlaybookPackBlock("formal-de", {
    orgName: "Hotel Alpha",
  });
  const casualBlock = formatPlaybookPackBlock("casual-de", {
    orgName: "Beach Bar",
  });
  const skylineBlock = formatPlaybookPackBlock("skyline");
  const chainBlock = formatPlaybookPackBlock("generic-chain");

  if (!formalBlock?.includes("Tone: formal")) {
    errors.push("formal-de block missing tone marker");
  }
  if (!casualBlock?.includes("Tone: casual")) {
    errors.push("casual-de block missing tone marker");
  }
  if (formalBlock === casualBlock) {
    errors.push("formal-de and casual-de playbook blocks must differ");
  }
  if (!formalBlock?.includes("Guten Appetit")) {
    errors.push("formal-de block missing signature phrase");
  }

  const burgerMessage = "Daj mi burger";
  const formalPreview = previewPlaybookPackTurn({
    packId: "formal-de",
    orgName: "Hotel Alpha",
    userMessage: burgerMessage,
  });
  const casualPreview = previewPlaybookPackTurn({
    packId: "casual-de",
    orgName: "Beach Bar",
    userMessage: burgerMessage,
  });

  if (!formalPreview.assistantMessage.includes("Guten Appetit")) {
    errors.push("formal preview missing signature phrase Guten Appetit");
  }
  if (!/Sehr gerne|Dürfte ich/i.test(formalPreview.assistantMessage)) {
    errors.push("formal burger preview should stay polite");
  }
  if (!/Klar|Lass dir's schmecken/i.test(casualPreview.assistantMessage)) {
    errors.push("casual burger preview should stay relaxed");
  }
  if (formalPreview.assistantMessage === casualPreview.assistantMessage) {
    errors.push("formal and casual previews must differ for same scenario");
  }

  if (!skylineBlock?.includes("Skyline Lounge")) {
    errors.push("skyline pack block missing Skyline Lounge tone marker");
  }
  if (!chainBlock?.includes("PLAYBOOK PACK (generic-chain)")) {
    errors.push("generic-chain pack block missing chain marker");
  }
  if (skylineBlock === chainBlock) {
    errors.push("skyline and generic-chain playbook blocks must differ");
  }

  const skylineEffective = mergeManifestConfig(
    CONCIERGE_PLATFORM_DEFAULTS,
    null,
    { orgCeilingRaw: orgManifestWithPack("skyline") }
  );
  const chainEffective = mergeManifestConfig(
    CONCIERGE_PLATFORM_DEFAULTS,
    null,
    { orgCeilingRaw: orgManifestWithPack("generic-chain") }
  );

  if (skylineEffective.playbookPackId !== "skyline") {
    errors.push("mergeManifestConfig did not resolve skyline playbookPackId");
  }
  if (chainEffective.playbookPackId !== "generic-chain") {
    errors.push("mergeManifestConfig did not resolve generic-chain playbookPackId");
  }

  const skylineEvidence = planEvidence({
    turnPlan: relationalTurnPlan,
    beliefs: beliefGraph([]),
    capabilities: skylineEffective.capabilities,
    profile: eliteProfile,
    guestMessage: "Zdravo",
    playbookBlock: skylineBlock,
  });

  const chainEvidence = planEvidence({
    turnPlan: relationalTurnPlan,
    beliefs: beliefGraph([]),
    capabilities: chainEffective.capabilities,
    profile: eliteProfile,
    guestMessage: "Hello",
    playbookBlock: chainBlock,
  });

  if (!skylineEvidence.pointers.includes("playbook.examples")) {
    errors.push("skyline perceive evidence missing playbook.examples pointer");
  }
  if (!skylineEvidence.evidenceBlock.includes("Skyline Lounge")) {
    errors.push("skyline FSP missing pack tone in situation pack");
  }
  if (!chainEvidence.evidenceBlock.includes("generic-chain")) {
    errors.push("generic-chain FSP missing pack tone in situation pack");
  }

  const skylineFsp = buildSituationPack({
    beliefs: beliefGraph([]),
    playbookBlock: skylineBlock,
  });
  if (!skylineFsp.includes("Skyline Lounge")) {
    errors.push("buildSituationPack did not embed skyline playbook block");
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
