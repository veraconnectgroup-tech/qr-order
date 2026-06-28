export {
  CORE_BELIEF_KEYS,
  belief,
  beliefGraph,
  getBelief,
  getBeliefValue,
  type Belief,
  type BeliefGraph,
  type BeliefSource,
  type CommittedFact,
  type ConversationMode,
  type DecideTurnPlanInput,
  type PlanUtteranceInput,
  type TurnPlan,
  type TurnPlanKind,
  type UtteranceIntent,
  type UtterancePlan,
} from "@/lib/denis/cognition/tde/turn-plan-types";

export {
  decideTurnPlan,
  isCasualSocialGuestMessage,
  isVagueRecommendMessage,
  looksLikeOrderLine,
  turnPlanAllowsUpsell,
} from "@/lib/denis/cognition/tde/decide-turn-plan";

export {
  classifyGuestIntent,
  classifyGuestIntentRegex,
  runIntentRouterAbEval,
  SemanticIntentCache,
  INTENT_ROUTER_AB_FIXTURES,
  type GuestRoutedIntent,
  type IntentRouteTier,
  type SemanticIntentResult,
} from "@/lib/denis/cognition/tde/semantic-intent-router";

export {
  modelTierForScore,
  routeTurnModel,
  runModelRouterEval,
  ModelEscalationRegistry,
  MODEL_ROUTER_EVAL_FIXTURES,
  type DenisModelTier,
  type ModelRouteDecision,
} from "@/lib/denis/cognition/tde/model-router";

export {
  scoreTurnComplexity,
  type TurnComplexityScore,
} from "@/lib/denis/cognition/tde/turn-complexity-scorer";

export {
  buildInterpretationTask,
  turnPlanFromInterpretationTask,
} from "@/lib/denis/cognition/tde/build-interpretation-task";

export {
  hasGuestPostureCommercePressure,
  resolveGuestPostureMode,
  type GuestPostureMode,
} from "@/lib/denis/cognition/tde/resolve-guest-posture";

export type {
  InterpretationEvidenceBudget,
  InterpretationSchema,
  InterpretationTask,
} from "@/lib/denis/cognition/tde/interpretation-task-types";

export {
  planUtterance,
  utteranceIncludesUpsellNudge,
} from "@/lib/denis/cognition/tde/utterance-plan";

export {
  collectTurnInterpretationsFromTimeline,
  extractTurnInterpretation,
  extractTurnInterpretationFromTimeline,
  normalizeTurnInterpretation,
  synthesizeTurnInterpretationFromRouter,
  type ExtractTurnInterpretationInput,
} from "@/lib/denis/cognition/tde/extract-turn-interpretation";

export type { TurnInterpretation } from "@/lib/denis/cognition/tde/turn-interpretation-types";

export {
  defaultGuestChatFallback,
  listTemplateKeys,
  resolveTemplateLocale,
  templateUtteranceForKey,
  tryTemplateUtterance,
  type TemplateLocale,
} from "@/lib/denis/cognition/tde/template-utterance";
