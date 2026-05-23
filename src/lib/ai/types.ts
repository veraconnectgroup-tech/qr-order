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
  currency: string;
  cachedAt: string;
};

export type AiRecommendation = {
  productId: string;
  reason: string;
};

export type AiStructuredResponse = {
  recommendations: AiRecommendation[];
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
  | "it";

export type BuildSystemPromptInput = {
  orgName: string;
  menuText: string;
  language: string;
  guestPrefs?: AiGuestPreferences | null;
  orderContext?: string | null;
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
