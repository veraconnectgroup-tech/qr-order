import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { planEvidence } from "@/lib/denis/cognition/context/plan-evidence";
import { beliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { mergeManifestConfig } from "@/lib/denis/cognition/manifest/merge-manifest-config";
import {
  formatPlaybookPackBlock,
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
};

/** MR-9 / C11 — Skyline pack tone must differ from generic chain pack. */
export function runPlaybookPackFixture(): PlaybookPackFixtureResult {
  const errors: string[] = [];

  const skylineOrg = parseVenueManifest(orgManifestWithPack("skyline"));
  const chainOrg = parseVenueManifest(orgManifestWithPack("generic-chain"));

  const skylinePackId = resolvePlaybookPackId(skylineOrg, null);
  const chainPackId = resolvePlaybookPackId(chainOrg, null);

  if (skylinePackId !== "skyline") {
    errors.push(`expected skyline pack id, got ${skylinePackId ?? "null"}`);
  }
  if (chainPackId !== "generic-chain") {
    errors.push(`expected generic-chain pack id, got ${chainPackId ?? "null"}`);
  }

  const skylineBlock = formatPlaybookPackBlock("skyline");
  const chainBlock = formatPlaybookPackBlock("generic-chain");

  if (!skylineBlock?.includes("Skyline Lounge")) {
    errors.push("skyline pack block missing Skyline Lounge tone marker");
  }
  if (!chainBlock?.includes("CHAIN HOTEL PLAYBOOK")) {
    errors.push("generic-chain pack block missing chain tone marker");
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
  if (!chainEvidence.evidenceBlock.includes("CHAIN HOTEL PLAYBOOK")) {
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
