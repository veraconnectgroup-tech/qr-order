import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { ConciergePersona } from "@/lib/denis/config/concierge-config.schema";
import type { GuestLevelId } from "@/lib/denis/commerce/loyalty/guest-level";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

export type AiGuestPreferences = {
  allergies: string[];
  mood: string;
};

export type AiProductSummary = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
};

export type AiMenuCachePayload = {
  menuText: string;
  productMap: Record<string, AiProductSummary>;
  catalog: Record<string, AiCatalogProduct>;
  currency: string;
  cachedAt: string;
};

export type AiConciergeIntent =
  | "recommend"
  | "order"
  | "clarify"
  | "confirm"
  | "status"
  | "menu_info"
  | "chat";

export type AiProposedItemResponse = {
  productId: string;
  quantity: number;
  modifierIds: string[];
  serveSize: string | null;
  notes: string;
};

export type AiRecommendation = {
  productId: string;
  reason: string;
  productName?: string;
  name?: string;
};

import type { TurnInterpretation } from "@/lib/denis/cognition/tde/turn-interpretation-types";

export type AiStructuredResponse = {
  intent: AiConciergeIntent;
  recommendations: AiRecommendation[];
  proposedItems: AiProposedItemResponse[];
  cartActions?: Array<{ productName: string; quantity?: number }>;
  quickReplies: string[];
  submitOrder: boolean;
  message: string;
  sessionId?: string;
  creditsRemaining?: number;
  /** L3 guest understanding — sentiment, preferences, modifications (regex purge). */
  turnInterpretation?: TurnInterpretation;
  structuredPerception?: Partial<AiStructuredResponse> & {
    intent?: AiConciergeIntent | string;
    submitOrder?: boolean;
    turnInterpretation?: TurnInterpretation;
    [key: string]: unknown;
  };
};

export type AiPromptLanguage =
  | "de"
  | "en"
  | "sr"
  | "hr"
  | "tr"
  | "fr"
  | "es"
  | "it"
  | "ru"
  | "ar";

export type BuildSystemPromptInput = {
  orgName: string;
  menuText: string;
  /** Resolved conversation language for this turn (identity, rules, output). */
  language: string;
  /** Venue menu default locale — for multilingual policy and detection baseline. */
  venueMenuLocale?: string;
  guestMessage?: string | null;
  guestPrefs?: AiGuestPreferences | null;
  orderContext?: string | null;
  browsingContext?: string | null;
  orderDraftContext?: string | null;
  allowOrdering?: boolean;
  playbookContext?: string | null;
  /** Denis promo intelligence block (verified codes + suggested offer). */
  promoContext?: string | null;
  /** ADR-023 MR-5 — evidence pointers block (replaces full menu when set). */
  evidenceBlock?: string | null;
  /** When true, omit full MENU section (banter / RAG-only turns). */
  omitFullMenu?: boolean;
  /** Journey phase — adds phase behavior when evidence lacks SITUATION PACK. */
  sessionPhase?: import("@/lib/scene/types").SessionPhase | null;
  /** ADR-042 / Prompt 50 — service-period greeting from rhythm priors. */
  servicePeriodGreeting?: string | null;
  /** Folded guest mental model — rushed/budget reply shaping. */
  guestMentalModel?: GuestMentalModel | null;
  /** Concierge persona — tone, humor, cultural layers (Prompt 85). */
  persona?: ConciergePersona | null;
  /** Guest loyalty level for adaptation layer. */
  guestLevel?: GuestLevelId | null;
  /** Return-guest memory projection for session continuity. */
  guestMemory?: GuestMemoryProjection | null;
  /** IANA timezone for time-of-day personality adaptation. */
  timezone?: string;
  /** Featured menu item for humor / memory hooks. */
  featuredProductName?: string | null;
  /** ADR-045 Restaurant tier — owner/staff-authored durable house knowledge. */
  restaurantKnowledgeBlock?: string | null;
};

export type OpenAiChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Required on a "tool" role message — which tool call this result answers. */
  toolCallId?: string;
};

/** ADR-049 — one callable tool definition (OpenAI Chat Completions tool-calling shape). */
export type OpenAiToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/** ADR-049 — one tool invocation the model asked for; arguments is the raw JSON string OpenAI returns. */
export type OpenAiToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type OpenAiCallResult = {
  /** Empty string when the model only returned tool calls (see toolCalls). */
  content: string;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  /** OpenAI prompt cache hits (when prompt caching enabled). */
  cachedPromptTokens?: number;
  model: string;
  /** ADR-049 — set only when tools were passed and the model asked to call one. */
  toolCalls?: OpenAiToolCall[];
};

export type ModerationResult =
  | { safe: true }
  | { safe: false; reason: string };
