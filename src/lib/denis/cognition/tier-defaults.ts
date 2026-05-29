import type {
  DenisPerceivePipeline,
  DenisRuntimeModelProfile,
  DenisServiceTier,
} from "@/lib/denis/cognition/runtime-profile-types";

export type DenisTierDefaults = {
  models: DenisRuntimeModelProfile;
  perceivePipeline: DenisPerceivePipeline;
  menuRagEnabled: boolean;
  maxContextTokens: number;
};

const MINI = "gpt-4o-mini";
const FOUR_O = "gpt-4o";

export const DENIS_TIER_DEFAULTS: Record<DenisServiceTier, DenisTierDefaults> = {
  standard: {
    models: { social: MINI, commerce: MINI, narrate: MINI },
    perceivePipeline: "unified",
    menuRagEnabled: false,
    maxContextTokens: 2000,
  },
  premium: {
    models: { social: FOUR_O, commerce: MINI, narrate: MINI },
    perceivePipeline: "split",
    menuRagEnabled: false,
    maxContextTokens: 3000,
  },
  elite: {
    models: { social: FOUR_O, commerce: FOUR_O, narrate: MINI },
    perceivePipeline: "split",
    menuRagEnabled: true,
    maxContextTokens: 4000,
  },
  enterprise: {
    models: { social: FOUR_O, commerce: FOUR_O, narrate: FOUR_O },
    perceivePipeline: "split",
    menuRagEnabled: true,
    maxContextTokens: 8000,
  },
};
