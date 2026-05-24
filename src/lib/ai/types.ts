import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";

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
};

export type AiStructuredResponse = {
  intent: AiConciergeIntent;
  recommendations: AiRecommendation[];
  proposedItems: AiProposedItemResponse[];
  quickReplies: string[];
  submitOrder: boolean;
  message: string;
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
  language: string;
  guestMessage?: string | null;
  guestPrefs?: AiGuestPreferences | null;
  orderContext?: string | null;
  browsingContext?: string | null;
  orderDraftContext?: string | null;
  allowOrdering?: boolean;
  playbookContext?: string | null;
};

export type OpenAiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenAiCallResult = {
  content: string;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  model: string;
};

export type ModerationResult =
  | { safe: true }
  | { safe: false; reason: string };
