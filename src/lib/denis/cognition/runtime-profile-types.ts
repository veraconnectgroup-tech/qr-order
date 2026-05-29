import { z } from "zod";

export const DenisServiceTierSchema = z.enum([
  "standard",
  "premium",
  "elite",
  "enterprise",
]);

export type DenisServiceTier = z.infer<typeof DenisServiceTierSchema>;

export const DenisPerceivePipelineSchema = z.enum(["unified", "split"]);

export type DenisPerceivePipeline = z.infer<typeof DenisPerceivePipelineSchema>;

export const DenisPerceiveModeSchema = z.enum(["social", "commerce"]);

export type DenisPerceiveMode = z.infer<typeof DenisPerceiveModeSchema>;

export type DenisRuntimeModelProfile = {
  social: string;
  commerce: string;
  narrate: string;
};

/** Effective runtime profile after manifest merge (ADR-023 MR-3). */
export type DenisRuntimeResolvedProfile = {
  tier: DenisServiceTier;
  perceivePipeline: DenisPerceivePipeline;
  menuRagEnabled: boolean;
  models: DenisRuntimeModelProfile;
  maxContextTokens: number;
};
