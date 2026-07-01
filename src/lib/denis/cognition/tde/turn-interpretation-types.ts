import type { ConversationAwaiting } from "@/lib/denis/cognition/beliefs/belief-types";
import type { ReferenceResolutionKind } from "@/lib/denis/cognition/conversation/conversation-graph";

/** LLM-extracted guest understanding — replaces regex heuristics (ADR-019 L3). */
export type GuestSentiment =
  | "positive"
  | "neutral"
  | "frustrated"
  | "confused";

export type GuestMealStage =
  | "pre_order"
  | "ordering"
  | "waiting"
  | "eating"
  | "dessert"
  | "paying";

export type TurnModification = {
  swap?: { from: string; to: string };
  remove?: string;
  add?: string;
  modifier?: string;
  cooking?: string;
};

export type TurnInterpretation = {
  sentiment: GuestSentiment;
  mealStage: GuestMealStage | null;
  modifications: TurnModification[];
  preferences: string[];
  followUpMinutes: number | null;
  partySize: number | null;
  /** Denis-side awaiting slot inferred from dialogue context. */
  awaiting: ConversationAwaiting;
  askedDessert: boolean;
  sidePreference: string | null;
  cookingPreference: string | null;
  agreedOrderLine: string | null;
  /** LLM-resolved deictic reference ("ono prvo", "jeftiniji"). */
  guestReferenceKind: ReferenceResolutionKind | null;
  guestReferenceDetail: string | null;
};

export const EMPTY_TURN_INTERPRETATION: TurnInterpretation = {
  sentiment: "neutral",
  mealStage: null,
  modifications: [],
  preferences: [],
  followUpMinutes: null,
  partySize: null,
  awaiting: null,
  askedDessert: false,
  sidePreference: null,
  cookingPreference: null,
  agreedOrderLine: null,
  guestReferenceKind: null,
  guestReferenceDetail: null,
};
