import { parseLeadingOrderQuantity } from "@/lib/denis/cognition/conversation/parse-order-quantity";

const GROUP_PERSONA_PREFIX =
  /^(?:za\s+(?:mene|meni|sebe|decu|deci|dete|djecu|djeci|ženu|zena|muža|muza|njega|nju|nas|vas|ih|mom|tati|tatu)|for\s+(?:me|myself|my\s+wife|my\s+husband|my\s+kids?|the\s+kids?|us)|für\s+(?:mich|meine\s+frau|meinen\s+mann|die\s+kinder))\s+/i;

const GROUP_PERSONA_HINT =
  /\b(?:za\s+(?:mene|meni|sebe|decu|deci|dete|djecu|djeci|ženu|zena|muža|muza|njega|nju|nas|vas|ih|mom|tati|tatu)|for\s+(?:me|myself|my\s+wife|my\s+husband|my\s+kids?|the\s+kids?|us)|für\s+(?:mich|meine\s+frau|meinen\s+mann|die\s+kinder))\b/i;

const MULTI_ITEM_SPLIT_DEFAULT = /\s+(?:i|und|and)\s+|,\s*/i;

const MULTI_ITEM_SPLIT_GROUP =
  /\s+(?:i|und|and)\s+|,\s*(?=za\s+(?:mene|meni|sebe|decu|deci|dete|djecu|djeci|ženu|zena|muža|muza|njega|nju|nas|vas|ih|mom|tati|tatu)\b|for\s+(?:me|myself|my)\b|für\s+(?:mich|meine|die)\b)/i;

function multiItemSplitPattern(message: string): RegExp {
  return GROUP_PERSONA_HINT.test(message)
    ? MULTI_ITEM_SPLIT_GROUP
    : MULTI_ITEM_SPLIT_DEFAULT;
}

export type ParsedOrderSegment = {
  persona: string | null;
  productText: string;
  quantity: number;
};

function normalizePersona(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

const MODIFIER_CONTINUATION =
  /^(?:sa|with|mit|medium|well|rare|bez|without|ohne|extra|ne\s+|ali\s+)/i;

function mergeModifierContinuations(parts: string[]): string[] {
  const merged: string[] = [];
  for (const part of parts) {
    if (merged.length > 0 && MODIFIER_CONTINUATION.test(part)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]!}, ${part}`;
      continue;
    }
    merged.push(part);
  }
  return merged;
}

export function extractGroupOrderPersona(segment: string): {
  persona: string | null;
  productText: string;
} {
  const trimmed = segment.trim();
  const match = trimmed.match(GROUP_PERSONA_PREFIX);
  if (!match) {
    return { persona: null, productText: trimmed };
  }

  const personaRaw = match[0].trim();
  const productText = trimmed.slice(match[0].length).trim();
  return {
    persona: normalizePersona(personaRaw),
    productText,
  };
}

export function parseOrderSegment(segment: string): ParsedOrderSegment {
  const { persona, productText: withoutPersona } = extractGroupOrderPersona(segment);
  const qtyParsed = parseLeadingOrderQuantity(withoutPersona);
  if (qtyParsed) {
    return {
      persona,
      productText: qtyParsed.remainder,
      quantity: qtyParsed.quantity,
    };
  }
  return {
    persona,
    productText: withoutPersona,
    quantity: 1,
  };
}

/** Split multi-item / group-order guest line into persona-aware segments. */
export function splitGroupOrderSegments(message: string): ParsedOrderSegment[] {
  const stripped = message
    .trim()
    .replace(
      /^(?:daj\s+mi|daj|ho[ćc]u|hocu|mo[žz]e|želim|zelim|give\s+me|i\s+want|can\s+i\s+get|molim(?:\s+te|\s+vas)?|please|i\s+need)\s+/i,
      ""
    )
    .replace(/\s+molim(?:\s+te|\s+vas)?\s*$/i, "")
    .trim();

  if (!stripped) return [];

  const rawParts = mergeModifierContinuations(
    stripped
      .split(multiItemSplitPattern(stripped))
      .map((part) => part.trim())
      .filter((part) => part.length >= 2)
  );

  const parts = rawParts.length ? rawParts : [stripped];
  return parts.map(parseOrderSegment);
}
