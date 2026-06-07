import { z } from "zod";
import { ConciergeToneSchema } from "@/lib/denis/config/concierge-config.schema";

/** Capability lattice 0–4 (ADR-023 §6). */
export const VenueCapabilityLevelSchema = z.number().int().min(0).max(4);

export type VenueCapabilityLevel = z.infer<typeof VenueCapabilityLevelSchema>;

export const VenueManifestCapabilitiesSchema = z.object({
  relational: VenueCapabilityLevelSchema,
  transactional: VenueCapabilityLevelSchema,
  catalogRag: VenueCapabilityLevelSchema,
  guestMemory: VenueCapabilityLevelSchema,
  anticipation: VenueCapabilityLevelSchema,
});

export type VenueManifestCapabilities = z.infer<
  typeof VenueManifestCapabilitiesSchema
>;

export const VenueManifestIdentitySchema = z.object({
  persona: ConciergeToneSchema.optional(),
  languages: z.array(z.string().trim().min(2).max(10)).min(1).max(20).optional(),
  defaultLanguage: z.string().trim().min(2).max(10),
});

export type VenueManifestIdentity = z.infer<typeof VenueManifestIdentitySchema>;

export const VenueManifestPolicySchema = z.object({
  requireExplicitConfirm: z.boolean().optional(),
  rushSkipUpsell: z.boolean().optional(),
  maxUpsellsPerSession: z.number().int().min(0).max(10).optional(),
});

export type VenueManifestPolicy = z.infer<typeof VenueManifestPolicySchema>;

export const VenueManifestModelsSchema = z.object({
  transactional: z.string().trim().min(1).max(80).optional(),
  relational: z.string().trim().min(1).max(80).optional(),
  narrate: z.string().trim().min(1).max(80).optional(),
});

export type VenueManifestModels = z.infer<typeof VenueManifestModelsSchema>;

export const VenueQualityContractSchema = z.object({
  refusalRateMax: z.number().min(0).max(1),
  evalPassMin: z.number().min(0).max(1),
  shadowParityMin: z.number().min(0).max(1),
  llmInvocationMax: z.number().min(0).max(1),
});

export type VenueQualityContract = z.infer<typeof VenueQualityContractSchema>;

export const VenueManifestSchema = z.object({
  manifestVersion: z.literal(1),
  identity: VenueManifestIdentitySchema.optional(),
  capabilities: VenueManifestCapabilitiesSchema,
  policy: VenueManifestPolicySchema.optional(),
  models: VenueManifestModelsSchema.optional(),
  qualityContract: VenueQualityContractSchema.optional(),
  /** MR-9 — org/chain playbook example pack (ADR-023 §10). */
  playbookPackId: z.string().trim().min(1).max(80).optional(),
});

export type VenueManifest = z.infer<typeof VenueManifestSchema>;

/** No manifest / invalid parse — do not clamp features below platform ceiling. */
export const VENUE_MANIFEST_OPEN_CAPABILITIES: VenueManifestCapabilities = {
  relational: 4,
  transactional: 4,
  catalogRag: 4,
  guestMemory: 4,
  anticipation: 4,
};

const MANIFEST_KEY_ALIASES: Record<string, string> = {
  manifest_version: "manifestVersion",
  default_language: "defaultLanguage",
  catalog_rag: "catalogRag",
  guest_memory: "guestMemory",
  quality_contract: "qualityContract",
  require_explicit_confirm: "requireExplicitConfirm",
  rush_skip_upsell: "rushSkipUpsell",
  max_upsells_per_session: "maxUpsellsPerSession",
  refusal_rate_max: "refusalRateMax",
  eval_pass_min: "evalPassMin",
  shadow_parity_min: "shadowParityMin",
  llm_invocation_max: "llmInvocationMax",
  playbook_pack_id: "playbookPackId",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeManifestKey(key: string): string {
  return MANIFEST_KEY_ALIASES[key] ?? key;
}

/** Accept ADR-023 §6 YAML/JSON (snake_case keys). */
export function normalizeVenueManifestInput(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeVenueManifestInput);
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    out[normalizeManifestKey(key)] = normalizeVenueManifestInput(child);
  }
  return out;
}

/** Parse stored manifest; null when missing or invalid (caller keeps ConciergeConfig). */
export function parseVenueManifest(value: unknown): VenueManifest | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizeVenueManifestInput(value);
  const parsed = VenueManifestSchema.safeParse(normalized);
  return parsed.success ? parsed.data : null;
}
