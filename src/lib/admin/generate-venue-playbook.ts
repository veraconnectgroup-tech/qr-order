export type VenuePlaybookTone =
  | "efficient"
  | "formal"
  | "friendly"
  | "playful_luxury";

export type PlaybookInput = {
  venueName: string;
  venueType: "bar" | "restaurant" | "fast_food" | string;
  menuSections: string[];
  priceRange?: "budget" | "mid" | "premium" | string | null;
  topProducts?: Array<{ name: string; category?: string | null }>;
  specialties?: string[];
  language?: string;
  tonePreference?: VenuePlaybookTone | null;
};

export type GeneratedVenuePlaybook = {
  tone: VenuePlaybookTone;
  playbook: string;
  examples: Array<{
    user_message: string;
    assistant_message: string;
  }>;
};

export function resolveVenuePlaybookTone(input: {
  venueType: string;
  priceRange?: string | null;
  tonePreference?: VenuePlaybookTone | null;
}): VenuePlaybookTone {
  if (input.tonePreference) return input.tonePreference;
  if (input.venueType === "fast_food") return "efficient";
  if (input.venueType === "bar" && input.priceRange === "premium") {
    return "playful_luxury";
  }
  if (input.priceRange === "premium") return "formal";
  return "friendly";
}

function firstTopProduct(input: PlaybookInput): string {
  return input.topProducts?.[0]?.name ?? input.specialties?.[0] ?? "signature item";
}

export function generateVenuePlaybook(
  input: PlaybookInput
): GeneratedVenuePlaybook {
  const tone = resolveVenuePlaybookTone(input);
  const sections = input.menuSections.map((section) => section.toLowerCase());
  const isBar = input.venueType === "bar" || sections.some((s) => s.includes("cocktail"));
  const topProduct = firstTopProduct(input);

  const rules = [
    isBar
      ? "Use a cocktail-first flow before moving to food."
      : "Start with the guest's main meal intent.",
    tone === "efficient"
      ? "Keep small talk short and move quickly to the order."
      : "Keep the tone warm and venue-specific.",
    `Recommend ${topProduct} when it matches the guest's mood.`,
    ...(input.specialties ?? []).map((item) => `Mention ${item} as a house specialty.`),
    ...(input.topProducts ?? [])
      .slice(0, 4)
      .map((item) => `Use ${item.name} as a verified top product.`),
    "Ask at most one follow-up question at a time.",
    "Never invent products outside the venue knowledge graph.",
    "Escalate allergies and safety-sensitive requests to staff.",
  ].slice(0, 10);

  return {
    tone,
    playbook: [
      `${input.venueName.toUpperCase()} PLAYBOOK:`,
      ...rules.map((rule) => `- ${rule}`),
    ].join("\n"),
    examples: [
      {
        user_message: "What should I try?",
        assistant_message: `Start with ${topProduct}; it fits this venue best.`,
      },
    ],
  };
}
