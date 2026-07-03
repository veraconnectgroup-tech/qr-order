import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import type { MenuCategory } from "@/components/guest/menu-grid";
import type { AiSheetSelections } from "@/lib/ai/guest-sheet-preferences";
import { inferMenuSection } from "@/lib/menu-section";

const DEMO_REASONS: Record<string, string> = {
  leicht: "Leicht und erfrischend — passt gut zu deinem Wunsch.",
  herzhaft: "Deftig und sättigend — genau richtig für heute Abend.",
  schnell: "Schnell zubereitet — ideal wenn es zügig gehen soll.",
  ueberraschung: "Unser Tipp — beliebt an der Bar und perfekt zum Probieren.",
};

export type DemoAiChatResponse = {
  messageKey:
    | "ai.chat.greeting"
    | "ai.demo.drinkReply"
    | "ai.demo.foodReply"
    | "ai.demo.veganReply"
    | "ai.demo.dessertReply"
    | "ai.demo.genericReply"
    | "ai.chat.demoFollowUp";
  recommendations: ProductRecommendation[];
};

function availableProducts(categories: MenuCategory[]) {
  return categories.flatMap((category) => category.products).filter((p) => p.is_available);
}

function toRecommendation(
  product: MenuCategory["products"][number],
  reason: string
): ProductRecommendation {
  return {
    productId: product.id,
    name: product.name,
    price: Number(product.price),
    imageUrl: product.image_url,
    reason,
  };
}

function pickFromPool(
  categories: MenuCategory[],
  pool: MenuCategory["products"][number][],
  reason: string,
  limit = 2
) {
  const products = pool.length >= 1 ? pool : availableProducts(categories);
  return products.slice(0, limit).map((product) => toRecommendation(product, reason));
}

function isPureGreeting(message: string): boolean {
  const text = message
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[!?.,:;'"`´]/g, " ")
    .replace(/\s+/g, " ");

  if (!text || text.length > 42) return false;

  const withoutName = text
    .replace(/\b(denis|denise|vera|konobaru|konobar)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /^(zdravo|cao|hej|ej|dobar dan|dobro jutro|dobro vece|hi|hello|hey|hallo|guten tag|servus|moin)$/.test(
    withoutName
  );
}

/** Static AI picks for the public demo menu (no OpenAI / Supabase). */
export function getDemoAiRecommendations(
  categories: MenuCategory[],
  selections: AiSheetSelections
): ProductRecommendation[] {
  const products = availableProducts(categories);
  const mood = selections.mood ?? "ueberraschung";
  const reason = DEMO_REASONS[mood] ?? DEMO_REASONS.ueberraschung;

  const picks =
    mood === "leicht"
      ? products.filter((p) => p.prep_time_minutes != null && p.prep_time_minutes <= 10)
      : mood === "schnell"
        ? products.filter((p) => (p.prep_time_minutes ?? 99) <= 8)
        : products;

  const pool = picks.length >= 2 ? picks : products;

  return pool.slice(0, 3).map((product) => toRecommendation(product, reason));
}

/** Demo follow-up chat without OpenAI. */
export function getDemoAiChatResponse(
  message: string,
  categories: MenuCategory[],
  selections?: AiSheetSelections
): DemoAiChatResponse {
  const text = message.toLowerCase();
  const mood = selections?.mood ?? "ueberraschung";
  const reason = DEMO_REASONS[mood] ?? DEMO_REASONS.ueberraschung;
  const products = availableProducts(categories);

  if (isPureGreeting(message)) {
    return {
      messageKey: "ai.chat.greeting",
      recommendations: [],
    };
  }

  const drinks = products.filter((product) => {
    const category = categories.find((row) =>
      row.products.some((item) => item.id === product.id)
    );
    return category ? inferMenuSection(category) === "drinks" : false;
  });

  const desserts = products.filter((product) => {
    const category = categories.find((row) =>
      row.products.some((item) => item.id === product.id)
    );
    return category ? inferMenuSection(category) === "desserts" : false;
  });

  if (
    /(getränk|drink|cocktail|wein|wine|bier|beer|aperol|negroni|spritz|pi[ćc]e|pivo|vino|koktel|sok|kafa)/i.test(
      text
    )
  ) {
    return {
      messageKey: "ai.demo.drinkReply",
      recommendations: pickFromPool(categories, drinks, reason),
    };
  }

  if (/(vegan|vegetar|pflanzlich|plant)/i.test(text)) {
    const veganPool = products.filter(
      (product) =>
        product.tags?.some((tag) => /vegan|vegetar/i.test(tag)) ||
        product.name.toLowerCase().includes("vegan")
    );
    return {
      messageKey: "ai.demo.veganReply",
      recommendations: pickFromPool(categories, veganPool, reason),
    };
  }

  if (/(dessert|desert|süß|suss|sweet|slatko|kola[čc]|kuchen|cake|tiramisu)/i.test(text)) {
    return {
      messageKey: "ai.demo.dessertReply",
      recommendations: pickFromPool(categories, desserts, reason),
    };
  }

  if (
    /(pasta|risotto|burger|steak|salat|salad|essen|food|gericht|dish|hrana|jelo|jela|gladan|rucak|ru[čc]ak|vecera|ve[čc]era)/i.test(
      text
    )
  ) {
    const foodPool = products.filter((product) => !drinks.includes(product));
    return {
      messageKey: "ai.demo.foodReply",
      recommendations: pickFromPool(categories, foodPool, reason, 3),
    };
  }

  if (text.length < 3) {
    return {
      messageKey: "ai.chat.demoFollowUp",
      recommendations: [],
    };
  }

  return {
    messageKey: "ai.demo.genericReply",
    recommendations: getDemoAiRecommendations(categories, {
      allergies: selections?.allergies ?? [],
      mood: selections?.mood ?? "ueberraschung",
    }).slice(0, 2),
  };
}
