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
  /** Display name — default "Denis". Wired into system prompt identity block. */
  name: z.string().trim().min(1).max(40),
  role: z.string().trim().max(120),
  /** Venue tone overlay — warm_short | formal | playful_luxury | efficient. */
  tone: ConciergeToneSchema,
  greetingStyle: ConciergeGreetingStyleSchema,
  /** Post-process strip list + humor safety guard. */
  forbiddenPhrases: z.array(z.string().trim().max(200)).max(50),
  emoji: z.boolean(),
  /** Reply length cap — personality engine enforces in prompt. */
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
  /** Adaptive ceiling — per-turn budget scales down for simple turns. */
  maxContextTokens: z.number().int().min(500).max(8000),
  /** When true, resolve per-turn budget from turn complexity (500–4000). */
  adaptiveContext: z.boolean().default(true),
  /** Floor for adaptive context budget on simple turns. */
  minContextTokens: z.number().int().min(200).max(2000).default(500),
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
  /** Follow-up after guest said "still browsing" (conversation loop). */
  browseFollowUp: z.boolean(),
  browseFollowUpSeconds: z.number().int().min(30).max(300),
  /** Bill prompt after last delivery + idle minutes. */
  billPrompt: z.boolean(),
  billPromptMinutes: z.number().int().min(5).max(120),
  /** Order delay status message (distinct from slow-kitchen drink upsell). */
  orderDelay: z.boolean(),
  orderDelayMinutes: z.number().int().min(5).max(120),
  /** Popularity pairing nudge from order history. */
  popularityPairing: z.boolean(),
  popularityBrowseMinutes: z.number().int().min(1).max(120),
  /** Personalized browse nudge from state.offer (GMM-10). */
  offerEnrich: z.boolean(),
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

const ConciergePipelineSchema = z.object({
  enabled: z.boolean().default(true),
  preSkills: z
    .array(z.string().trim().max(64))
    .max(20)
    .default([
      "pre.allergy_guard",
      "pre.cart_state",
      "pre.menu_filter",
    ]),
  postSkills: z
    .array(z.string().trim().max(64))
    .max(20)
    .default([
      "post.order_validator",
      "post.price_check",
      "post.tone_guard",
      "post.safety_guard",
    ]),
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
  crossVenue: z
    .object({
      enabled: z.boolean().default(true),
      venueType: z
        .enum(["casual", "fine_dining", "cafe", "bar"])
        .default("casual"),
    })
    .default({ enabled: true, venueType: "casual" }),
});

/** M3 — proactive timing optimizer; owner approves unless autoApply. */
const ConciergeThresholdOptimizerSchema = z.object({
  autoApply: z.boolean().default(false),
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

const ConciergeMentalModelSchema = z.object({
  /** Legacy — when true and mode=off, treated as enforce (see resolveMentalModelMode). */
  enabled: z.boolean(),
  mode: z.enum(["off", "shadow", "enforce"]).default("off"),
  nudgeBudgetDefault: z.number().int().min(0).max(10),
  nudgeBudgetEnthusiastic: z.number().int().min(1).max(10),
  declineCooldownSeconds: z.number().int().min(0).max(600),
  frustrationEscalateThreshold: z.enum(["mild", "high"]),
  confidenceFallbackThreshold: z.number().min(0).max(1).default(0.4),
});

const ConciergeInterventionSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["off", "shadow", "enforce"]).default("off"),
  /** Promoted manifest version id (e.g. ijs-v1) — ADR-041 P3. */
  manifestVersion: z.string().trim().min(1).max(40).nullable().optional(),
});

const ConciergeRhythmOpsSchema = z.object({
  rushAlerts: z.boolean(),
  staffingHints: z.boolean(),
  rushThreshold: z.number().min(1).max(5).default(1.8),
  targetSessionsPerWaiter: z.number().int().min(1).max(12).default(4),
  staffingOccupancyThreshold: z.number().min(0).max(1).default(0.55),
});

const ConciergeRhythmSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["off", "shadow", "enforce"]).default("off"),
  minSampleSessions: z.number().int().min(1).max(100).default(8),
  minConfidence: z.number().min(0).max(1).default(0.4),
  ops: ConciergeRhythmOpsSchema,
});

const ConciergeIntelligenceWeatherSchema = z.object({
  enabled: z.boolean(),
  openWeatherMapApiKey: z.string().trim().max(128).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
});

export const ConciergeIntelligenceSchema = z.object({
  contextAwareness: z.boolean(),
  timezone: z.string().trim().min(1).max(64),
  dailyMenuLabel: z.string().trim().max(120).nullable(),
  localSportsTeam: z.string().trim().max(80).nullable(),
  weather: ConciergeIntelligenceWeatherSchema,
});

export type ConciergeIntelligence = z.infer<typeof ConciergeIntelligenceSchema>;

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
  thresholdOptimizer: ConciergeThresholdOptimizerSchema,
  memory: ConciergeMemorySchema,
  surfaces: ConciergeSurfacesSchema,
  mentalModel: ConciergeMentalModelSchema,
  intervention: ConciergeInterventionSchema,
  rhythm: ConciergeRhythmSchema,
  intelligence: ConciergeIntelligenceSchema,
  pipeline: ConciergePipelineSchema.default({
    enabled: true,
    preSkills: [
      "pre.allergy_guard",
      "pre.cart_state",
      "pre.menu_filter",
    ],
    postSkills: [
      "post.order_validator",
      "post.price_check",
      "post.tone_guard",
      "post.safety_guard",
    ],
  }),
});

export type ConciergeConfig = z.infer<typeof ConciergeConfigSchema>;

export type ConciergeTone = z.infer<typeof ConciergeToneSchema>;
export type ConciergeGreetingStyle = z.infer<typeof ConciergeGreetingStyleSchema>;
export type ConciergeFlowPreset = z.infer<typeof ConciergeFlowPresetSchema>;
export type ConciergeLanguageFallback = z.infer<
  typeof ConciergeLanguageFallbackSchema
>;
export type ConciergePersona = z.infer<typeof ConciergePersonaSchema>;
export type ConciergeLanguage = z.infer<typeof ConciergeLanguageSchema>;
export type ConciergeContext = z.infer<typeof ConciergeContextSchema>;
export type ConciergeOrdering = z.infer<typeof ConciergeOrderingSchema>;
export type ConciergeUpsell = z.infer<typeof ConciergeUpsellSchema>;
export type ConciergeProactive = z.infer<typeof ConciergeProactiveSchema>;

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
export const PartialConciergeThresholdOptimizerSchema =
  ConciergeThresholdOptimizerSchema.partial();
export const PartialConciergeMemorySchema = ConciergeMemorySchema.partial();
export const PartialConciergeSurfacesSchema = ConciergeSurfacesSchema.partial();
export const PartialConciergeMentalModelSchema = ConciergeMentalModelSchema.partial();
export const PartialConciergeInterventionSchema = ConciergeInterventionSchema.partial();
export const PartialConciergeRhythmOpsSchema = ConciergeRhythmOpsSchema.partial();
export const PartialConciergeRhythmSchema = ConciergeRhythmSchema.omit({ ops: true })
  .partial()
  .extend({
    ops: PartialConciergeRhythmOpsSchema.optional(),
  });
export const PartialConciergeIntelligenceWeatherSchema =
  ConciergeIntelligenceWeatherSchema.partial();
export const PartialConciergeIntelligenceSchema =
  ConciergeIntelligenceSchema.omit({ weather: true })
    .partial()
    .extend({
      weather: PartialConciergeIntelligenceWeatherSchema.optional(),
    });
export const PartialConciergePipelineSchema = ConciergePipelineSchema.partial();

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
  thresholdOptimizer: PartialConciergeThresholdOptimizerSchema.optional(),
  memory: PartialConciergeMemorySchema.optional(),
  surfaces: PartialConciergeSurfacesSchema.optional(),
  mentalModel: PartialConciergeMentalModelSchema.optional(),
  intervention: PartialConciergeInterventionSchema.optional(),
  rhythm: PartialConciergeRhythmSchema.optional(),
  intelligence: PartialConciergeIntelligenceSchema.optional(),
  pipeline: PartialConciergePipelineSchema.optional(),
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
