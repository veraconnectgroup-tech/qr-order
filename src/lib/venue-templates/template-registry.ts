import type { PartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

export type VenueTemplate = {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaults: PartialConciergeConfig;
  suggestedMenuSections: string[];
  suggestedTableZones: string[];
};

function persona(
  input: Partial<PartialConciergeConfig["persona"]>
): PartialConciergeConfig {
  return {
    persona: {
      name: "Denis",
      role: "friendly waiter",
      tone: "warm_short",
      greetingStyle: "offer_drink_or_food",
      forbiddenPhrases: [],
      emoji: true,
      maxWordsPerReply: 40,
      ...input,
    },
    language: {
      venueDefault: "de",
      followGuest: true,
      fallbackWhenUnknown: "english",
    },
    ordering: {
      flow: "denis_short",
      requireExplicitConfirm: true,
      allowMultiItemParse: true,
      slotExtractEnabled: true,
      actLayerEnabled: true,
      actDryRun: false,
      actSubmitEnabled: true,
      defaultServeSize: null,
      maxItemsPerOrder: 30,
      maxQuantityPerLine: 10,
    },
    upsell: {
      foodAfterDrinks: true,
      foodAfterDrinksProductIds: null,
      dessertAfterDelivered: true,
      dessertDelayMinutes: 12,
      maxUpsellsPerSession: 2,
      respectDecline: true,
    },
    proactive: {
      enabled: true,
      browseNudgeMinutes: 3,
      billPromptMinutes: 45,
    },
  };
}

export const CASUAL_RESTAURANT: VenueTemplate = {
  id: "casual-restaurant",
  name: "Casual Restaurant",
  description: "Friendly neighborhood dining — warm Denis, gentle upsell.",
  icon: "🍽️",
  defaults: persona({
    role: "friendly waiter",
    tone: "warm_short",
    greetingStyle: "offer_drink_or_food",
    maxWordsPerReply: 40,
    emoji: true,
  }),
  suggestedMenuSections: ["Appetizers", "Main Courses", "Desserts", "Drinks"],
  suggestedTableZones: ["Indoor", "Terrace", "Bar"],
};

export const FINE_DINING: VenueTemplate = {
  id: "fine-dining",
  name: "Fine Dining",
  description: "Formal sommelier tone — wine pairing and tasting focus.",
  icon: "🥂",
  defaults: persona({
    role: "sommelier & concierge",
    tone: "formal",
    greetingStyle: "venue_story",
    maxWordsPerReply: 60,
    emoji: false,
  }),
  suggestedMenuSections: [
    "Amuse-Bouche",
    "Entrées",
    "Plats",
    "Fromages",
    "Desserts",
    "Wines",
  ],
  suggestedTableZones: ["Salon", "Terrace", "Private"],
};

export const BAR_LOUNGE: VenueTemplate = {
  id: "bar-lounge",
  name: "Bar & Lounge",
  description: "Drinks-first — fast reflex ordering, refill nudges.",
  icon: "🍸",
  defaults: persona({
    role: "bar concierge",
    tone: "efficient",
    greetingStyle: "offer_drink_or_food",
    maxWordsPerReply: 30,
    emoji: false,
  }),
  suggestedMenuSections: ["Cocktails", "Wine", "Beer", "Snacks"],
  suggestedTableZones: ["Bar", "Lounge", "Terrace"],
};

export const CAFE: VenueTemplate = {
  id: "cafe",
  name: "Café",
  description: "Coffee & light bites — short replies, browse-friendly.",
  icon: "☕",
  defaults: persona({
    role: "café host",
    tone: "warm_short",
    greetingStyle: "welcome_only",
    maxWordsPerReply: 35,
    emoji: true,
  }),
  suggestedMenuSections: ["Coffee", "Tea", "Pastries", "Light Bites"],
  suggestedTableZones: ["Indoor", "Patio", "Counter"],
};

export const FAST_CASUAL: VenueTemplate = {
  id: "fast-casual",
  name: "Fast Casual",
  description: "Quick service — efficient flow, minimal chit-chat.",
  icon: "🥡",
  defaults: persona({
    role: "order assistant",
    tone: "efficient",
    greetingStyle: "welcome_only",
    maxWordsPerReply: 25,
    emoji: false,
  }),
  suggestedMenuSections: ["Bowls", "Burgers", "Sides", "Drinks"],
  suggestedTableZones: ["Counter", "Pickup", "Dine-in"],
};

export const FOOD_TRUCK: VenueTemplate = {
  id: "food-truck",
  name: "Food Truck",
  description: "Ultra-short Denis — order and go.",
  icon: "🚚",
  defaults: persona({
    role: "order assistant",
    tone: "efficient",
    greetingStyle: "welcome_only",
    maxWordsPerReply: 20,
    emoji: false,
  }),
  suggestedMenuSections: ["Specials", "Mains", "Drinks"],
  suggestedTableZones: ["Pickup Window"],
};

export const VENUE_TEMPLATES: VenueTemplate[] = [
  CASUAL_RESTAURANT,
  FINE_DINING,
  BAR_LOUNGE,
  CAFE,
  FAST_CASUAL,
  FOOD_TRUCK,
];

export function getVenueTemplate(id: string): VenueTemplate | null {
  return VENUE_TEMPLATES.find((template) => template.id === id) ?? null;
}
