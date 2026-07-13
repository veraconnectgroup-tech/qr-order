import type { AiStructuredResponse } from "@/lib/ai/types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import {
  classifyGuestIntent,
  type GuestRoutedIntent,
} from "@/lib/denis/cognition/tde/semantic-intent-router";
import {
  EMPTY_TURN_INTERPRETATION,
  type GuestMealStage,
  type GuestSentiment,
  type TurnInterpretation,
  type TurnModification,
} from "@/lib/denis/cognition/tde/turn-interpretation-types";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function sentimentFromRouterIntent(intent: GuestRoutedIntent): GuestSentiment {
  if (intent === "complaint" || intent === "status") return "frustrated";
  if (intent === "decline") return "neutral";
  if (intent === "smalltalk" || intent === "settling") return "positive";
  return "neutral";
}

function mealStageFromRouterIntent(intent: GuestRoutedIntent): GuestMealStage | null {
  switch (intent) {
    case "settling":
      return "paying";
    case "order":
    case "modification":
    case "reorder":
    case "round":
    case "copy_order":
      return "ordering";
    case "status":
    case "complaint":
      return "waiting";
    case "preorder":
      return "pre_order";
    case "browse":
    case "price_inquiry":
    case "promo_inquiry":
    case "still_browsing":
      return "pre_order";
    default:
      return null;
  }
}

function followUpMinutesFromFormat(message: string): number | null {
  const text = message.trim();
  if (!text) return null;

  const digitMatch =
    text.match(/\b(\d{1,2})\s*minut(?:a|e|i)?\b/i) ??
    text.match(/\b(\d{1,2})\s*minutes?\b/i);
  if (digitMatch) {
    const minutes = Number(digitMatch[1]);
    if (Number.isFinite(minutes) && minutes >= 1 && minutes <= 30) {
      return minutes;
    }
  }

  if (/\bza\s+(koj[ií]|par|nekoliko|few)\s*minut/i.test(text)) {
    return 1;
  }

  if (
    /\bza\s+minut\b/i.test(text) &&
    /(?:dođi|dodj|come\s+back|vrati\s+se|check\s+back)/i.test(text)
  ) {
    return 1;
  }

  return null;
}

const SWAP_MARKER = /\b(?:umesto|umjesto|statt|anstatt|instead\s+of)\b/i;

const SWAP_SIDE_INTRO: readonly string[] = ["sa", "s", "mit", "with"];

const SWAP_CONJUNCTION = /\s+(?:i|and|und|pa|plus)\s+|[,.;!?]/i;

/** Deterministic "X umesto Y" swap when LLM interpretation is unavailable. */
function swapModificationFromText(text: string): TurnModification | null {
  const marker = SWAP_MARKER.exec(text);
  if (!marker) return null;

  const before = text.slice(0, marker.index).trim();
  const after = text.slice(marker.index + marker[0].length).trim();
  if (!before || !after) return null;

  // Requested side: words after the last "sa/mit/with" marker, else trailing words.
  const beforeWords = before.split(/\s+/);
  let introIdx = -1;
  for (let i = beforeWords.length - 1; i >= 0; i--) {
    if (SWAP_SIDE_INTRO.includes(beforeWords[i]!.toLowerCase())) {
      introIdx = i;
      break;
    }
  }
  const requestedWords =
    introIdx >= 0 ? beforeWords.slice(introIdx + 1) : beforeWords.slice(-3);
  const requested = requestedWords.join(" ").trim();

  // Replaced side: words up to the next conjunction / punctuation.
  const insteadOf = after.split(SWAP_CONJUNCTION)[0]?.trim() ?? "";

  if (requested.length < 2 || insteadOf.length < 2) return null;
  return { swap: { from: insteadOf, to: requested } };
}

const CANCEL_ITEM_PATTERNS: Array<{ regex: RegExp; group: number }> = [
  { regex: /\b(?:odustani|odustanem)\s+(?:od|from)\s+(.+)/i, group: 1 },
  { regex: /\b(?:cancel|storniraj|ukloni|remove|obri[sš]i)\s+(.+)/i, group: 1 },
  { regex: /\bne\s+(?:treba|želim|zelim|ho[cć]u|hocu)\s+(.+)/i, group: 1 },
];

/** Deterministic cart-line-cancel detection when LLM interpretation is unavailable. */
function cancelItemModificationFromText(text: string): TurnModification | null {
  for (const { regex, group } of CANCEL_ITEM_PATTERNS) {
    const match = text.match(regex);
    const target = match?.[group]?.trim();
    if (target && target.length >= 2) {
      return { cancelItem: target };
    }
  }
  return null;
}

/** Router fallback when LLM did not return turnInterpretation (T0/T1 / template turns). */
export function synthesizeTurnInterpretationFromRouter(
  guestMessage: string
): TurnInterpretation {
  const text = guestMessage.trim();
  if (!text) return { ...EMPTY_TURN_INTERPRETATION };

  const route = classifyGuestIntent(text);
  const intent = route.intent;
  const followUpMinutes = followUpMinutesFromFormat(text);
  const swap = swapModificationFromText(text);
  const cancelItem = swap ? null : cancelItemModificationFromText(text);
  const modifications: TurnModification[] = [];
  if (swap) modifications.push(swap);
  if (cancelItem) modifications.push(cancelItem);

  return {
    ...EMPTY_TURN_INTERPRETATION,
    sentiment: sentimentFromRouterIntent(intent),
    mealStage: mealStageFromRouterIntent(intent),
    modifications,
    followUpMinutes,
  };
}

export type ExtractTurnInterpretationInput = {
  structured?: Partial<AiStructuredResponse> | null;
  guestMessage?: string;
  llmUsed?: boolean;
};

/**
 * Build canonical turn interpretation after perceive — LLM output first,
 * semantic router synthesis as fallback.
 */
export function extractTurnInterpretation(
  input: ExtractTurnInterpretationInput
): TurnInterpretation {
  const llmBlock = input.structured?.turnInterpretation;
  if (llmBlock) {
    return normalizeTurnInterpretation(llmBlock);
  }

  return synthesizeTurnInterpretationFromRouter(input.guestMessage ?? "");
}

/** Read latest turn interpretation from timeline perceive events. */
export function extractTurnInterpretationFromTimeline(
  timeline: DenisTimelineRow[]
): TurnInterpretation | null {
  for (let i = timeline.length - 1; i >= 0; i--) {
    const row = timeline[i]!;
    const interpretation = readInterpretationFromTimelineRow(row);
    if (interpretation) return interpretation;
  }
  return null;
}

/** All guest-turn interpretations in timeline order (for active memory / fold). */
export function collectTurnInterpretationsFromTimeline(
  timeline: DenisTimelineRow[]
): Array<{ atMs: number; guestText: string | null; interpretation: TurnInterpretation }> {
  const rows: Array<{
    atMs: number;
    guestText: string | null;
    interpretation: TurnInterpretation;
  }> = [];

  for (const row of timeline) {
    if (row.event_type !== "perception.ingested") continue;
    const interpretation = readInterpretationFromTimelineRow(row);
    if (!interpretation) continue;

    const payload = asRecord(row.payload);
    const frame = asRecord(payload.frame);
    const guestText =
      typeof frame.normalizedText === "string"
        ? frame.normalizedText
        : typeof payload.text === "string"
          ? payload.text
          : null;

    rows.push({
      atMs: new Date(row.created_at).getTime(),
      guestText,
      interpretation,
    });
  }

  return rows;
}

export function readGuestInterpretationFromTimelineRow(
  row: DenisTimelineRow
): TurnInterpretation | null {
  return readInterpretationFromTimelineRow(row);
}

function readInterpretationFromTimelineRow(
  row: DenisTimelineRow
): TurnInterpretation | null {
  if (row.event_type !== "perception.ingested") return null;
  const payload = asRecord(row.payload);
  const frame = asRecord(payload.frame);
  const interpretation =
    payload.turnInterpretation ?? payload.interpretation ?? frame.interpretation;
  if (interpretation && typeof interpretation === "object") {
    return normalizeTurnInterpretation(interpretation);
  }
  return null;
}

export function normalizeTurnInterpretation(
  raw: unknown
): TurnInterpretation {
  if (!raw || typeof raw !== "object") return { ...EMPTY_TURN_INTERPRETATION };
  const row = raw as Record<string, unknown>;

  const sentiment = row.sentiment;
  const validSentiment =
    sentiment === "positive" ||
    sentiment === "neutral" ||
    sentiment === "frustrated" ||
    sentiment === "confused"
      ? sentiment
      : "neutral";

  const mealStage = row.mealStage;
  const validMealStage =
    mealStage === "pre_order" ||
    mealStage === "ordering" ||
    mealStage === "waiting" ||
    mealStage === "eating" ||
    mealStage === "dessert" ||
    mealStage === "paying"
      ? mealStage
      : null;

  const modifications = Array.isArray(row.modifications)
    ? row.modifications.filter((m) => m && typeof m === "object")
    : [];

  const preferences = Array.isArray(row.preferences)
    ? row.preferences.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    : [];

  const followUpMinutes =
    typeof row.followUpMinutes === "number" && row.followUpMinutes > 0
      ? Math.round(row.followUpMinutes)
      : null;

  const partySize =
    typeof row.partySize === "number" && row.partySize >= 1
      ? Math.round(row.partySize)
      : null;

  const awaiting = typeof row.awaiting === "string" ? row.awaiting : null;

  const guestReferenceKind = row.guestReferenceKind;
  const validReferenceKind =
    guestReferenceKind === "active_topic_price" ||
    guestReferenceKind === "topic_switch" ||
    guestReferenceKind === "clone_for_friend" ||
    guestReferenceKind === "first_mentioned" ||
    guestReferenceKind === "cheaper_variant" ||
    guestReferenceKind === "last_denis_recommendation" ||
    guestReferenceKind === "none"
      ? guestReferenceKind
      : null;

  return {
    sentiment: validSentiment,
    mealStage: validMealStage,
    modifications: modifications as TurnInterpretation["modifications"],
    preferences,
    followUpMinutes,
    partySize,
    awaiting: awaiting as TurnInterpretation["awaiting"],
    askedDessert: row.askedDessert === true,
    sidePreference:
      typeof row.sidePreference === "string" ? row.sidePreference.trim() : null,
    cookingPreference:
      typeof row.cookingPreference === "string"
        ? row.cookingPreference.trim()
        : null,
    agreedOrderLine:
      typeof row.agreedOrderLine === "string" ? row.agreedOrderLine.trim() : null,
    guestReferenceKind: validReferenceKind,
    guestReferenceDetail:
      typeof row.guestReferenceDetail === "string"
        ? row.guestReferenceDetail.trim()
        : null,
  };
}
