import type { ConciergeRolloutMode } from "@/lib/denis/config/rollout";
import type { PartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { TABLE_OS_PILOT_CONFIG_PATCH } from "@/lib/denis/config/pilot-wiring";

/** Ops ladder presets — location-level partial overrides (M25). */
export type DenisRolloutPresetId =
  | "shadow_observe"
  | "shadow_instrumented"
  | "canary_10"
  | "denis_guest_narration"
  | "denis_kernel_ordering"
  | "denis_full_shadow_act"
  | "denis_act_submit_pilot"
  | "agentic_canary_5"
  | "agentic_live_canary_5"
  | "agentic_live_100"
  | "upds_enforce_pilot"
  | "loss_prevention_pilot"
  | "table_os_pilot";

export type DenisRolloutPreset = {
  id: DenisRolloutPresetId;
  label: string;
  description: string;
  patch: PartialConciergeConfig;
};

const SHADOW_SAFE_ACT: PartialConciergeConfig["ordering"] = {
  actLayerEnabled: false,
  actDryRun: true,
  actSubmitEnabled: false,
};

export const DENIS_ROLLOUT_PRESETS: DenisRolloutPreset[] = [
  {
    id: "shadow_observe",
    label: "Shadow — observe only",
    description:
      "Guests see legacy chat; Denis kernel + timeline + shadow diff run in parallel.",
    patch: {
      version: 1,
      rollout: { mode: "shadow" },
      llm: { narrateWithLlm: false, slotExtractWithLlm: false },
      ordering: { slotExtractEnabled: false, ...SHADOW_SAFE_ACT },
      memory: { returnGuestEnabled: false },
      surfaces: { voiceEnabled: false },
    },
  },
  {
    id: "shadow_instrumented",
    label: "Shadow — instrumented",
    description:
      "Shadow mode plus T2 slot extract on timeline (legacy still orders).",
    patch: {
      version: 1,
      rollout: { mode: "shadow" },
      llm: { narrateWithLlm: false, slotExtractWithLlm: false },
      ordering: { slotExtractEnabled: true, ...SHADOW_SAFE_ACT },
      memory: { returnGuestEnabled: false },
      surfaces: { voiceEnabled: false },
    },
  },
  {
    id: "canary_10",
    label: "Canary 10%",
    description:
      "~10% of table sessions see Denis guest path; others stay legacy. Kernel on for all.",
    patch: {
      version: 1,
      rollout: { mode: "canary", canaryPercent: 10 },
      llm: { narrateWithLlm: true, slotExtractWithLlm: false },
      ordering: { slotExtractEnabled: true, ...SHADOW_SAFE_ACT },
      memory: { returnGuestEnabled: false },
      surfaces: { voiceEnabled: false },
    },
  },
  {
    id: "denis_guest_narration",
    label: "Denis guest path",
    description:
      "Guests see linted Denis narration (T3 facts LLM when enabled). Act stays dry-run.",
    patch: {
      version: 1,
      rollout: { mode: "denis_only" },
      llm: { narrateWithLlm: true, slotExtractWithLlm: false },
      ordering: { slotExtractEnabled: true, ...SHADOW_SAFE_ACT },
      memory: { returnGuestEnabled: false },
      surfaces: { voiceEnabled: false },
    },
  },
  {
    id: "denis_kernel_ordering",
    label: "Kernel ordering (F8-2)",
    description:
      "Legacy adapter LLM-only; cart mutations via kernel bridge + act timeline.",
    patch: {
      version: 1,
      rollout: { mode: "shadow" },
      llm: { narrateWithLlm: false, slotExtractWithLlm: false },
      ordering: {
        slotExtractEnabled: true,
        actLayerEnabled: true,
        actDryRun: true,
        actSubmitEnabled: false,
      },
      memory: { returnGuestEnabled: false },
      surfaces: { voiceEnabled: false },
    },
  },
  {
    id: "denis_full_shadow_act",
    label: "Denis + memory (safe act)",
    description:
      "Full guest Denis path, return-guest memory, act layer on timeline only (dry-run).",
    patch: {
      version: 1,
      rollout: { mode: "denis_only" },
      llm: { narrateWithLlm: true, slotExtractWithLlm: false },
      ordering: {
        slotExtractEnabled: true,
        actLayerEnabled: true,
        actDryRun: true,
        actSubmitEnabled: false,
      },
      memory: { returnGuestEnabled: true },
      surfaces: { voiceEnabled: false },
    },
  },
  {
    id: "denis_act_submit_pilot",
    label: "Act submit pilot (F8-3)",
    description:
      "Denis guest path + kernel ordering + live ACL order submit. Requires eval green + venue sign-off.",
    patch: {
      version: 1,
      rollout: { mode: "denis_only" },
      llm: { narrateWithLlm: true, slotExtractWithLlm: false },
      ordering: {
        slotExtractEnabled: true,
        actLayerEnabled: true,
        actDryRun: false,
        actSubmitEnabled: true,
      },
      memory: { returnGuestEnabled: false },
      surfaces: { voiceEnabled: false },
    },
  },
  {
    id: "agentic_canary_5",
    label: "Agentic loop — shadow 5%",
    description:
      "ADR-049 P4 pilot: agentic tool loop runs in shadow for ~5% of sessions. Guests still see single-call perceive until shadowOnly is disabled in config.",
    patch: {
      version: 1,
      rollout: { mode: "canary", canaryPercent: 10 },
      llm: { narrateWithLlm: true, slotExtractWithLlm: false },
      ordering: { slotExtractEnabled: true, ...SHADOW_SAFE_ACT },
      ops: {
        agenticToolLoop: {
          enabled: true,
          shadowOnly: true,
          canaryPercent: 5,
          maxRounds: 3,
          legacySingleCallFallback: true,
          creditsPerExtraRound: 0,
        },
      },
    },
  },
  {
    id: "agentic_live_canary_5",
    label: "Agentic loop — live 5%",
    description:
      "ADR-049 P4: live agentic tool loop for ~5% cohort; legacy single-call fallback remains on if the loop fails.",
    patch: {
      version: 1,
      rollout: { mode: "denis_only" },
      llm: { narrateWithLlm: true, slotExtractWithLlm: false },
      ordering: {
        slotExtractEnabled: true,
        actLayerEnabled: true,
        actDryRun: false,
        actSubmitEnabled: true,
      },
      ops: {
        agenticToolLoop: {
          enabled: true,
          shadowOnly: false,
          canaryPercent: 5,
          maxRounds: 3,
          legacySingleCallFallback: true,
          creditsPerExtraRound: 0,
        },
      },
    },
  },
  {
    id: "agentic_live_100",
    label: "Agentic loop — live 100% (P5)",
    description:
      "ADR-049 P5: full agentic tool loop for all sessions; legacy single-call fallback disabled.",
    patch: {
      version: 1,
      rollout: { mode: "denis_only" },
      llm: { narrateWithLlm: true, slotExtractWithLlm: false },
      ordering: {
        slotExtractEnabled: true,
        actLayerEnabled: true,
        actDryRun: false,
        actSubmitEnabled: true,
      },
      ops: {
        agenticToolLoop: {
          enabled: true,
          shadowOnly: false,
          canaryPercent: 100,
          maxRounds: 3,
          legacySingleCallFallback: false,
          creditsPerExtraRound: 0,
        },
      },
    },
  },
  {
    id: "upds_enforce_pilot",
    label: "UPDS enforce pilot",
    description:
      "ADR-040 R1: GMM enforce + offer enrich paired — single proactive decider path.",
    patch: {
      version: 1,
      rollout: { mode: "denis_only" },
      llm: { narrateWithLlm: true, slotExtractWithLlm: false },
      ordering: { slotExtractEnabled: true, ...SHADOW_SAFE_ACT },
      proactive: {
        enabled: true,
        offerEnrich: true,
      },
      mentalModel: {
        enabled: true,
        mode: "enforce",
      },
    },
  },
  {
    id: "loss_prevention_pilot",
    label: "Loss prevention pilot",
    description:
      "ADR-044: enable all guardrails + suspicious report for owner/manager review.",
    patch: {
      version: 1,
      ops: {
        lossPrevention: {
          enabled: true,
          voidLadderEnabled: true,
          transferInvariantsEnabled: true,
          paymentGuardrailsEnabled: true,
          cashRiskEnabled: true,
          discountPatternsEnabled: true,
          suspiciousReportEnabled: true,
          discountDeviationMultiplier: 2,
          digestMaxItems: 10,
          cashSessionOpenMinutes: 120,
        },
      },
    },
  },
  {
    id: "table_os_pilot",
    label: "Table OS pilot (G3)",
    description:
      "Full pilot: denis_only + floor graph + proactive + act submit. Ping /api/cron/denis-pilot-tick every minute (external cron on Hobby).",
    patch: TABLE_OS_PILOT_CONFIG_PATCH,
  },
];

export type DenisRolloutFormState = {
  rolloutMode: ConciergeRolloutMode;
  canaryPercent: number;
  narrateWithLlm: boolean;
  slotExtractEnabled: boolean;
  slotExtractWithLlm: boolean;
  returnGuestEnabled: boolean;
  voiceEnabled: boolean;
  actLayerEnabled: boolean;
  actDryRun: boolean;
  actSubmitEnabled: boolean;
};

/** Map effective merged config to admin form fields. */
export function denisRolloutFormFromEffective(config: {
  rollout: { mode: ConciergeRolloutMode; canaryPercent: number };
  llm: {
    narrateWithLlm: boolean;
    slotExtractWithLlm: boolean;
  };
  ordering: {
    slotExtractEnabled: boolean;
    actLayerEnabled: boolean;
    actDryRun: boolean;
    actSubmitEnabled: boolean;
  };
  memory: { returnGuestEnabled: boolean };
  surfaces: { voiceEnabled: boolean };
}): DenisRolloutFormState {
  return {
    rolloutMode: config.rollout.mode,
    canaryPercent: config.rollout.canaryPercent,
    narrateWithLlm: config.llm.narrateWithLlm,
    slotExtractEnabled: config.ordering.slotExtractEnabled,
    slotExtractWithLlm: config.llm.slotExtractWithLlm,
    returnGuestEnabled: config.memory.returnGuestEnabled,
    voiceEnabled: config.surfaces.voiceEnabled,
    actLayerEnabled: config.ordering.actLayerEnabled,
    actDryRun: config.ordering.actDryRun,
    actSubmitEnabled: config.ordering.actSubmitEnabled,
  };
}

/** Build location partial patch from admin form (validated by caller). */
export function denisRolloutPatchFromForm(
  form: DenisRolloutFormState
): PartialConciergeConfig {
  return {
    version: 1,
    rollout: {
      mode: form.rolloutMode,
      canaryPercent: form.canaryPercent,
    },
    llm: {
      narrateWithLlm: form.narrateWithLlm,
      slotExtractWithLlm: form.slotExtractWithLlm,
    },
    ordering: {
      slotExtractEnabled: form.slotExtractEnabled,
      actLayerEnabled: form.actLayerEnabled,
      actDryRun: form.actDryRun,
      actSubmitEnabled: form.actSubmitEnabled,
    },
    memory: { returnGuestEnabled: form.returnGuestEnabled },
    surfaces: { voiceEnabled: form.voiceEnabled },
  };
}

export function denisRolloutFormFromPreset(
  presetId: DenisRolloutPresetId
): DenisRolloutFormState | null {
  const preset = DENIS_ROLLOUT_PRESETS.find((row) => row.id === presetId);
  if (!preset?.patch.rollout?.mode) return null;

  const ordering = preset.patch.ordering ?? {};
  const llm = preset.patch.llm ?? {};
  const memory = preset.patch.memory ?? {};
  const surfaces = preset.patch.surfaces ?? {};

  return {
    rolloutMode: preset.patch.rollout.mode,
    canaryPercent: preset.patch.rollout.canaryPercent ?? 10,
    narrateWithLlm: llm.narrateWithLlm ?? false,
    slotExtractEnabled: ordering.slotExtractEnabled ?? false,
    slotExtractWithLlm: llm.slotExtractWithLlm ?? false,
    returnGuestEnabled: memory.returnGuestEnabled ?? false,
    voiceEnabled: surfaces.voiceEnabled ?? false,
    actLayerEnabled: ordering.actLayerEnabled ?? false,
    actDryRun: ordering.actDryRun ?? true,
    actSubmitEnabled: ordering.actSubmitEnabled ?? false,
  };
}
