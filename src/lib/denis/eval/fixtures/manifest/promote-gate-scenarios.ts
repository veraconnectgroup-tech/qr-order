import type { VenueManifest } from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import { IOTA_TIMELINE_OBLIGATION_SCENARIOS } from "@/lib/denis/eval/fixtures/timeline/iota-obligation-scenarios";
import { IOTA_FIXTURE_AI_SESSION } from "@/lib/denis/eval/fixtures/timeline/helpers";

/** Shared baseline for manifest promote gate CI (ADR-023 MR-8 / ADR-033 AGENT-26). */
export const MANIFEST_PROMOTE_BASE: VenueManifest = {
  manifestVersion: 1,
  capabilities: {
    relational: 3,
    transactional: 4,
    catalogRag: 2,
    guestMemory: 2,
    anticipation: 2,
  },
  policy: {
    requireExplicitConfirm: true,
    rushSkipUpsell: false,
    maxUpsellsPerSession: 2,
  },
  qualityContract: {
    refusalRateMax: 0,
    evalPassMin: 1,
    shadowParityMin: 0.99,
    llmInvocationMax: 0.35,
  },
};

export type ManifestPromoteGateScenario = {
  id: string;
  description: string;
  currentManifest: VenueManifest | null;
  proposedManifest: VenueManifest;
  timeline?: DenisTimelineRow[];
  simSessionId?: string | null;
  expect: {
    ok: boolean;
    requiresTimelineSim: boolean;
    violationIncludes?: string[];
  };
};

const completeCartTimeline = IOTA_TIMELINE_OBLIGATION_SCENARIOS.find(
  (row) => row.id === "tl_iota_complete_cart_confirm"
)!.timeline;

/** Deterministic promote gate scenarios — no DB, no LLM. */
export const MANIFEST_PROMOTE_GATE_SCENARIOS: ManifestPromoteGateScenario[] = [
  {
    id: "mg_first_promote",
    description: "First manifest promote skips timeline sim",
    currentManifest: null,
    proposedManifest: MANIFEST_PROMOTE_BASE,
    expect: { ok: true, requiresTimelineSim: false },
  },
  {
    id: "mg_policy_change_no_session",
    description: "Policy delta blocks without timeline replay",
    currentManifest: MANIFEST_PROMOTE_BASE,
    proposedManifest: {
      ...MANIFEST_PROMOTE_BASE,
      policy: { ...MANIFEST_PROMOTE_BASE.policy!, rushSkipUpsell: true },
    },
    expect: {
      ok: false,
      requiresTimelineSim: true,
      violationIncludes: ["timeline sim required"],
    },
  },
  {
    id: "mg_policy_change_timeline_green",
    description: "Safe policy delta passes iota timeline sim replay",
    currentManifest: MANIFEST_PROMOTE_BASE,
    proposedManifest: {
      ...MANIFEST_PROMOTE_BASE,
      policy: { ...MANIFEST_PROMOTE_BASE.policy!, maxUpsellsPerSession: 3 },
    },
    timeline: completeCartTimeline,
    simSessionId: IOTA_FIXTURE_AI_SESSION,
    expect: { ok: true, requiresTimelineSim: true },
  },
  {
    id: "mg_identity_only_no_sim",
    description: "Identity-only change does not require timeline sim",
    currentManifest: MANIFEST_PROMOTE_BASE,
    proposedManifest: {
      ...MANIFEST_PROMOTE_BASE,
      identity: { defaultLanguage: "sr", persona: "warm_short" },
    },
    expect: { ok: true, requiresTimelineSim: false },
  },
];
