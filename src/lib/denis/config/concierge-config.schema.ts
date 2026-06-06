import { z } from "zod";
import { ConciergeRolloutSchema } from "@/lib/denis/config/rollout";

export const ConciergeToneSchema = z.enum([
  "warm_short",
  "formal",
  "playful_luxury",
  "efficient",
]);

export const ConciergeGreetingStyleSchema = z.enum([
  "offer_drink_or_food",
  "welcome_only",
  "venue_story",
]);

export const ConciergeFlowPresetSchema = z.enum([
  "denis_short",
  "classic_chatty",
]);

export const ConciergeLanguageFallbackSchema = z.enum(["venue", "english"]);

export const ConciergePlaybookVariantSchema = z.enum(["A", "B"]);

const ConciergePersonaSchema = z.object({
  name: z.string().trim().min(1).max(40),
  role: z.string().trim().max(120),
  tone: ConciergeToneSchema,
  greetingStyle: ConciergeGreetingStyleSchema,
  forbiddenPhrases: z.array(z.string().trim().max(200)).max(50),
  emoji: z.boolean(),
  maxWordsPerReply: z.number().int().min(10).max(200),
});

const ConciergeLanguageSchema = z.object({
  venueDefault: z.string().trim().min(2).max(10),
  followGuest: z.boolean(),
  fallbackWhenUnknown: ConciergeLanguageFallbackSchema,
});

const ConciergeContextSchema = z.object({
  scroll: z.boolean(),
  tableOrders: z.boolean(),
  orderStatus: z.boolean(),
  manualCart: z.boolean(),
  orderHistory: z.boolean(),
  includePairingHistory: z.boolean(),
  maxContextTokens: z.number().int().min(500).max(8000),
});

const ConciergeOrderingSchema = z.object({
  flow: ConciergeFlowPresetSchema,
  requireExplicitConfirm: z.boolean(),
  allowMultiItemParse: z.boolean(),
  /** M22 — Denis T2 slot extract on timeline (shadow signal; legacy still orders). */
  slotExtractEnabled: z.boolean(),
  /** M23 — execute planned skills (default dry-run timeline only). */
  actLayerEnabled: z.boolean(),
  actDryRun: z.boolean(),
  actSubmitEnabled: z.boolean(),
  defaultServeSize: z.string().trim().max(40).nullable(),
  maxItemsPerOrder: z.number().int().min(1).max(100),
  maxQuantityPerLine: z.number().int().min(1).max(99),
});

const ConciergeUpsellSchema = z.object({
  foodAfterDrinks: z.boolean(),
  foodAfterDrinksProductIds: z.array(z.string().uuid()).nullable(),
  dessertAfterDelivered: z.boolean(),
  dessertDelayMinutes: z.number().int().min(0).max(120),
  maxUpsellsPerSession: z.number().int().min(0).max(10),
  respectDecline: z.boolean(),
});

const ProactiveTimeOfDaySchema = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Expected HH:MM");

const ConciergeProactiveSchema = z.object({
  enabled: z.boolean(),
  browseNudgeMinutes: z.number().int().min(1).max(60),
  pairing: z.boolean(),
  dessert: z.boolean(),
  slowKitchen: z.boolean(),
  slowKitchenThresholdMinutes: z.number().int().min(5).max(120),
  reviewPrompt: z.boolean(),
  reviewPromptAfterDelivered: z.boolean(),
  minMinutesBetweenProactive: z.number().int().min(1).max(60),
  shareSessionWithChat: z.boolean(),
  /** QR scan welcome after idle seconds (0 guest messages). */
  guestWelcome: z.boolean(),
  guestWelcomeSeconds: z.number().int().min(10).max(300),
  /** Bill prompt after last delivery + idle minutes. */
  billPrompt: z.boolean(),
  billPromptMinutes: z.number().int().min(5).max(120),
  /** Order delay status message (distinct from slow-kitchen drink upsell). */
  orderDelay: z.boolean(),
  orderDelayMinutes: z.number().int().min(5).max(120),
  /** Popularity pairing nudge from order history. */
  popularityPairing: z.boolean(),
  popularityBrowseMinutes: z.number().int().min(1).max(120),
  /** Staff alert: table idle without interaction. */
  staffTableIdle: z.boolean(),
  staffTableIdleMinutes: z.number().int().min(5).max(120),
  /** Staff alert: allergy mention in guest chat. */
  staffAllergy: z.boolean(),
  /** Staff alert: waiter request / escalation. */
  staffWaiterRequest: z.boolean(),
  /** Daily prep briefing for staff (cron). */
  dailyPrep: z.boolean(),
  dailyPrepHour: ProactiveTimeOfDaySchema,
  /** End-of-day manager report (cron). */
  dailyReport: z.boolean(),
  dailyReportHour: ProactiveTimeOfDaySchema,
});

const ConciergePolicySchema = z.object({
  allergiesStrict: z.boolean(),
  blockAlcoholWithoutFood: z.boolean(),
  blockOrderingWhenClosed: z.boolean(),
  maxOrderTotal: z.number().positive().nullable(),
  requireServeSizeForDrinks: z.boolean(),
});

const ConciergeLlmSchema = z.object({
  model: z.string().trim().max(80).nullable(),
  fallbackModel: z.string().trim().max(80).nullable(),
  temperatureOrdering: z.number().min(0).max(1),
  temperatureRecommend: z.number().min(0).max(1),
  parseRetryAttempts: z.number().int().min(0).max(3),
  skipLlmWhenPossible: z.boolean(),
  /** M21 — T3 narration from facts only (requires rollout denis_only). */
  narrateWithLlm: z.boolean(),
  /** M22 — LLM fallback when heuristic slot extract finds nothing. */
  slotExtractWithLlm: z.boolean(),
});

const ConciergeHandoffSchema = z.object({
  waiterCall: z.boolean(),
  paymentHint: z.boolean(),
  /** M28 — execute handoff ACL even when order act layer is dry-run. */
  liveExecution: z.boolean(),
  phrases: z.array(z.string().trim().max(120)).max(30),
});

const ConciergeExperimentsSchema = z.object({
  playbookVariant: ConciergePlaybookVariantSchema.nullable(),
  exampleSetId: z.string().trim().max(80).nullable(),
});

const ConciergeCreditsSchema = z.object({
  chargeProactive: z.boolean(),
  chargeDeterministic: z.boolean(),
});

const ConciergePartySchema = z.object({
  mode: z.enum(["shared_cart", "per_device"]),
});

const ConciergeOpsSchema = z.object({
  staffHintsEnabled: z.boolean(),
  rushSkipUpsell: z.boolean(),
  kdsStressSkipUpsell: z.boolean(),
  floorGraphEnabled: z.boolean(),
  autoRushEnabled: z.boolean(),
  autoRushBacklogMinutes: z.number().int().min(5).max(120),
});

const ConciergeLearningSchema = z.object({
  learnedEdgesEnabled: z.boolean(),
  minAcceptRateForSuggestion: z.number().min(0).max(1),
  minImpressionsForSuggestion: z.number().int().min(1).max(1000),
});

const ConciergeMemorySchema = z.object({
  returnGuestEnabled: z.boolean(),
  memoryTtlDays: z.number().int().min(7).max(365),
  consentPromptTemplate: z.string().trim().max(300).nullable(),
});

const ConciergeSurfacesSchema = z.object({
  voiceEnabled: z.boolean(),
  voiceTtsEnabled: z.boolean(),
});

export const ConciergeConfigSchema = z.object({
  version: z.literal(1),
  enabled: z.boolean(),
  persona: ConciergePersonaSchema,
  language: ConciergeLanguageSchema,
  context: ConciergeContextSchema,
  ordering: ConciergeOrderingSchema,
  upsell: ConciergeUpsellSchema,
  proactive: ConciergeProactiveSchema,
  policy: ConciergePolicySchema,
  llm: ConciergeLlmSchema,
  handoff: ConciergeHandoffSchema,
  experiments: ConciergeExperimentsSchema,
  credits: ConciergeCreditsSchema,
  rollout: ConciergeRolloutSchema,
  party: ConciergePartySchema,
  ops: ConciergeOpsSchema,
  learning: ConciergeLearningSchema,
  memory: ConciergeMemorySchema,
  surfaces: ConciergeSurfacesSchema,
});

export type ConciergeConfig = z.infer<typeof ConciergeConfigSchema>;

export const PartialConciergePersonaSchema = ConciergePersonaSchema.partial();
export const PartialConciergeLanguageSchema = ConciergeLanguageSchema.partial();
export const PartialConciergeContextSchema = ConciergeContextSchema.partial();
export const PartialConciergeOrderingSchema = ConciergeOrderingSchema.partial();
export const PartialConciergeUpsellSchema = ConciergeUpsellSchema.partial();
export const PartialConciergeProactiveSchema = ConciergeProactiveSchema.partial();
export const PartialConciergePolicySchema = ConciergePolicySchema.partial();
export const PartialConciergeLlmSchema = ConciergeLlmSchema.partial();
export const PartialConciergeHandoffSchema = ConciergeHandoffSchema.partial();
export const PartialConciergeExperimentsSchema = ConciergeExperimentsSchema.partial();
export const PartialConciergeCreditsSchema = ConciergeCreditsSchema.partial();
export const PartialConciergeRolloutSchema = ConciergeRolloutSchema.partial();
export const PartialConciergePartySchema = ConciergePartySchema.partial();
export const PartialConciergeOpsSchema = ConciergeOpsSchema.partial();
export const PartialConciergeLearningSchema = ConciergeLearningSchema.partial();
export const PartialConciergeMemorySchema = ConciergeMemorySchema.partial();
export const PartialConciergeSurfacesSchema = ConciergeSurfacesSchema.partial();

export const PartialConciergeConfigSchema = z.object({
  version: z.literal(1).optional(),
  enabled: z.boolean().optional(),
  persona: PartialConciergePersonaSchema.optional(),
  language: PartialConciergeLanguageSchema.optional(),
  context: PartialConciergeContextSchema.optional(),
  ordering: PartialConciergeOrderingSchema.optional(),
  upsell: PartialConciergeUpsellSchema.optional(),
  proactive: PartialConciergeProactiveSchema.optional(),
  policy: PartialConciergePolicySchema.optional(),
  llm: PartialConciergeLlmSchema.optional(),
  handoff: PartialConciergeHandoffSchema.optional(),
  experiments: PartialConciergeExperimentsSchema.optional(),
  credits: PartialConciergeCreditsSchema.optional(),
  rollout: PartialConciergeRolloutSchema.optional(),
  party: PartialConciergePartySchema.optional(),
  ops: PartialConciergeOpsSchema.optional(),
  learning: PartialConciergeLearningSchema.optional(),
  memory: PartialConciergeMemorySchema.optional(),
  surfaces: PartialConciergeSurfacesSchema.optional(),
});

export type PartialConciergeConfig = z.infer<typeof PartialConciergeConfigSchema>;

/** Parse stored JSONB; returns null when invalid (caller falls back). */
export function parsePartialConciergeConfig(
  value: unknown
): PartialConciergeConfig | null {
  const parsed = PartialConciergeConfigSchema.safeParse(value);
  if (!parsed.success) return null;
  const keys = Object.keys(parsed.data);
  if (keys.length === 0) return null;
  return parsed.data;
}

export function parseConciergeConfig(value: unknown): ConciergeConfig | null {
  const parsed = ConciergeConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
