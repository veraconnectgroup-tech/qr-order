import {
  estimateContextTokens,
  scoreContextFreshness,
} from "@/lib/denis/cognition/context/context-budget";
import type { ConversationGraph } from "@/lib/denis/cognition/conversation/conversation-graph";
import {
  formatConversationGraphBlock,
  resolveGuestReference,
} from "@/lib/denis/cognition/conversation/topic-tracker";
import { foldTranscriptFromTimeline } from "@/lib/denis/loop/fold-transcript";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import {
  formatGuestRelationshipBlock,
  guestMemoryPersonalizationAllowed,
  shouldOfferDessert,
  shouldOfferStarter,
} from "@/lib/denis/platform/guest-memory-format";

export type ActiveMemory = {
  guestPreferences: string[];
  openQuestions: string[];
  agreedFacts: string[];
  /** Up to 5 semantic key facts — not raw transcript lines. */
  keyFacts: string[];
  /** Single-line semantic compression of older turns. */
  semanticSummary: string;
  moodShift: string | null;
  conversationSummary: string;
  tokensSaved: number;
  rawTail: Array<{ role: "guest" | "denis"; text: string }>;
  avgFreshness: number;
  conversationGraph: ConversationGraph | null;
  graphContextBlock: string;
  referenceResolution: string | null;
};

type DialogueMessage = { role: "guest" | "denis"; text: string };

const DEFAULT_MAX_ACTIVE_MEMORY_TOKENS = 500;
const DENIS_QUESTION_PATTERN = /\?|da\s+li|jeste\s+li|have\s+you|haben\s+sie|möchten\s+sie/i;

const PREFERENCE_PATTERNS: Array<{ pattern: RegExp; format: (match: RegExpMatchArray) => string }> = [
  {
    pattern: /\bbez\s+([a-zčćžšđa-zäöüß]+(?:\s+[a-zčćžšđa-zäöüß]+){0,3})/i,
    format: (m) => `bez ${m[1]!.trim()}`,
  },
  {
    pattern: /\bne\s+(ljuto|pijaci|slatko|slano|luk|luka|mesa|meso)\b/i,
    format: (m) => `ne ${m[1]!.toLowerCase()}`,
  },
  {
    pattern: /\balergij[aue]?\s+na\s+([^?.!,]+)/i,
    format: (m) => `alergija na ${m[1]!.trim()}`,
  },
  {
    pattern: /\bwithout\s+([^?.!,]+)/i,
    format: (m) => `without ${m[1]!.trim()}`,
  },
  {
    pattern: /\bno\s+(onion|garlic|nuts|dairy|meat|spicy|gluten)\b/i,
    format: (m) => `no ${m[1]!.toLowerCase()}`,
  },
  {
    pattern: /\bohne\s+([^?.!,]+)/i,
    format: (m) => `ohne ${m[1]!.trim()}`,
  },
  {
    pattern: /\b(vegan(?:sko|ski)?|vegetarijan(?:sko|ski)?)\b/i,
    format: (m) => m[1]!.toLowerCase(),
  },
];

const FRUSTRATION_PATTERN =
  /\b(čekam|sporo|predugo|loš[eo]|užas|frustri|ljut|annoyed|angry|waiting\s+forever|zu\s+lange|schlecht)\b/i;

const RECOVERY_PATTERN =
  /\b(hvala|ok|u\s+redu|super|nema\s+veze|passt|danke|thanks|all\s+good|sad\s+je\s+ok)\b/i;

const EMPATHY_DENIS_PATTERN =
  /\b(izvinite|žao\s+mi\s+je|razumem|verstehe|sorry|empati|čekate|wartezeit)\b/i;

const AGREED_ORDER_PATTERN =
  /\b(\d+\s*[x×]\s*[a-zčćžšđ0-9\s-]{2,40})/i;

const TABLE_PATTERN = /\b(sto|stol|table)\s*#?\s*(\d+)\b/i;

const COOKING_PATTERN =
  /\b(medium\s+rare|medium|well\s+done|rare|bloody|roštilj|stepen\s+pečenja)\b/i;

const SIDE_PATTERN =
  /\b(pomfrit(?:om|a)?|pomf|fries|prilog|side|salata|salad|riža|rice)\b/i;

const DESSERT_ASK_PATTERN =
  /\b(desert|dessert|slatki|slatko|kolač|torta|palačink)\b/i;

const ORDER_VERB_PATTERN =
  /\b(traž|traz|hoću|hocu|daj|naruč|naruc|want|order|bestell|möchte)\b/i;

type TimestampedMessage = DialogueMessage & { atMs: number };

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

function extractPreferences(messages: DialogueMessage[]): string[] {
  const prefs: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "guest") continue;
    for (const { pattern, format } of PREFERENCE_PATTERNS) {
      const match = msg.text.match(pattern);
      if (match) prefs.push(format(match));
    }
  }
  return uniqueStrings(prefs);
}

function extractAgreedFacts(messages: DialogueMessage[]): string[] {
  const facts: string[] = [];

  for (const msg of messages) {
    const orderMatch = msg.text.match(AGREED_ORDER_PATTERN);
    if (orderMatch) {
      facts.push(orderMatch[1]!.trim());
    }

    const tableMatch = msg.text.match(TABLE_PATTERN);
    if (tableMatch) {
      facts.push(`${tableMatch[1]!.toLowerCase()} ${tableMatch[2]}`);
    }
  }

  for (let i = 0; i < messages.length - 1; i++) {
    const guest = messages[i]!;
    const denis = messages[i + 1];
    if (guest.role !== "guest" || !denis || denis.role !== "denis") continue;

    if (
      /\b(može|da|ajde|potvrđujem|confirm|ja\s+bitte|yes)\b/i.test(guest.text) &&
      /\b(ćevap|burger|pivo|order|narudžb|recap|potvr)/i.test(denis.text)
    ) {
      const recap = denis.text.slice(0, 80).trim();
      if (recap) facts.push(`potvrđeno: ${recap}`);
    }
  }

  return uniqueStrings(facts).slice(0, 6);
}

function extractOpenQuestions(messages: DialogueMessage[]): string[] {
  const open: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;

    if (msg.role === "guest" && msg.text.includes("?")) {
      const answered = messages
        .slice(i + 1)
        .some(
          (later) =>
            later.role === "denis" &&
            later.text.length > 12 &&
            !DENIS_QUESTION_PATTERN.test(later.text.slice(-40))
        );
      if (!answered) {
        open.push(`gost pitao: ${msg.text.slice(0, 100).trim()}`);
      }
    }

    if (
      msg.role === "denis" &&
      DENIS_QUESTION_PATTERN.test(msg.text) &&
      i === messages.length - 1
    ) {
      open.push(`Denis čeka odgovor: ${msg.text.slice(0, 100).trim()}`);
    }
  }

  return uniqueStrings(open).slice(0, 4);
}

function detectMoodShift(messages: DialogueMessage[]): string | null {
  let frustratedAt: number | null = null;
  let recoveredAt: number | null = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    if (msg.role === "guest" && FRUSTRATION_PATTERN.test(msg.text)) {
      frustratedAt = i;
      recoveredAt = null;
    }
    if (frustratedAt !== null && i > frustratedAt) {
      if (msg.role === "guest" && RECOVERY_PATTERN.test(msg.text)) {
        recoveredAt = i;
      }
      if (msg.role === "denis" && EMPATHY_DENIS_PATTERN.test(msg.text)) {
        recoveredAt = i;
      }
    }
  }

  if (frustratedAt === null) return null;
  if (recoveredAt !== null && recoveredAt > frustratedAt) {
    return "bio frustriran, sada OK nakon empatičnog odgovora";
  }
  return "gost je bio frustriran — budi empatičan";
}

function buildDeterministicSummary(
  summarized: DialogueMessage[],
  guestTurns: number,
  denisTurns: number
): string {
  const topics: string[] = [];
  const joined = summarized.map((m) => m.text.toLowerCase()).join(" ");

  if (/\b(pivo|piće|beer|drink|getränk)\b/.test(joined)) topics.push("piće");
  if (/\b(hrana|jelo|food|meni|menu|essen)\b/.test(joined)) topics.push("hrana");
  if (/\b(desert|slatki|dessert|kolač)\b/.test(joined)) topics.push("desert");
  if (/\b(račun|plat|bill|pay|zahl)\b/.test(joined)) topics.push("račun");

  const topicPart =
    topics.length > 0
      ? `Teme: ${topics.join(", ")}.`
      : "Razgovor o narudžbi i meniju.";

  return [
    `Sesija: ${guestTurns} poruka gosta, ${denisTurns} Denis odgovora.`,
    topicPart,
    summarized.length > 0
      ? `Raniji dio: ${summarized[summarized.length - 1]?.role === "guest" ? "gost" : "Denis"} zadnji rekao "${summarized[summarized.length - 1]!.text.slice(0, 60)}".`
      : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 320);
}

function resolveTailSize(messageCount: number): number {
  if (messageCount <= 10) return messageCount;
  if (messageCount <= 20) return 10;
  return 5;
}

function resolveTailSizeWithFreshness(
  messageCount: number,
  avgFreshness: number
): number {
  const base = resolveTailSize(messageCount);
  if (avgFreshness >= 0.85) return base;
  if (avgFreshness >= 0.65) return Math.max(3, base - 3);
  return Math.max(2, Math.floor(base / 2));
}

function averageFreshness(
  messages: TimestampedMessage[],
  nowMs: number
): number {
  if (messages.length === 0) return 1;
  const sum = messages.reduce(
    (acc, msg) => acc + scoreContextFreshness(nowMs - msg.atMs),
    0
  );
  return sum / messages.length;
}

function extractCookingPreference(messages: DialogueMessage[]): string | null {
  for (const msg of messages) {
    if (msg.role !== "guest") continue;
    const match = msg.text.match(COOKING_PATTERN);
    if (match) return match[1]!.toLowerCase();
  }
  return null;
}

function extractSidePreference(messages: DialogueMessage[]): string | null {
  for (const msg of messages) {
    if (msg.role !== "guest") continue;
    const match = msg.text.match(SIDE_PATTERN);
    if (match) return match[1]!.toLowerCase();
  }
  return null;
}

function extractMainOrderItem(messages: DialogueMessage[]): string | null {
  for (const msg of messages) {
    if (msg.role !== "guest") continue;
    const burger = msg.text.match(/\b(burger|ćevap|steak|pizza|pasta)\b/i);
    if (burger) return burger[1]!.toLowerCase();
    const qty = msg.text.match(AGREED_ORDER_PATTERN);
    if (qty) return qty[1]!.trim();
  }
  return null;
}

function guestAskedAboutDessert(messages: DialogueMessage[]): boolean {
  return messages.some(
    (msg) => msg.role === "guest" && DESSERT_ASK_PATTERN.test(msg.text)
  );
}

/** Semantic compression — 20 turns → ≤5 key facts, ~40 tokens narrative. */
export function buildSemanticKeyFacts(input: {
  messages: DialogueMessage[];
  /** Full thread including raw tail — for open questions / dessert asks. */
  fullMessages?: DialogueMessage[];
  preferences: string[];
  agreedFacts: string[];
  openQuestions: string[];
}): { keyFacts: string[]; semanticSummary: string } {
  const { messages, preferences, agreedFacts, openQuestions } = input;
  const fullMessages = input.fullMessages ?? messages;
  const keyFacts: string[] = [];

  const mainItem = extractMainOrderItem(messages);
  const cooking = extractCookingPreference(messages);
  const side = extractSidePreference(messages);
  const prefs = preferences.slice(0, 3);

  if (mainItem || prefs.length > 0) {
    const parts: string[] = [];
    if (mainItem) parts.push(mainItem);
    if (prefs.length > 0) parts.push(prefs.join(", "));
    if (cooking) parts.push(cooking);
    if (side) parts.push(`sa ${side}`);
    keyFacts.push(`Gost traži ${parts.join(", ")}`.replace(/,\s*,/g, ","));
  }

  for (const fact of agreedFacts.slice(0, 2)) {
    keyFacts.push(`Dogovoreno: ${fact}`);
  }

  if (guestAskedAboutDessert(fullMessages)) {
    keyFacts.push("Pita za desert");
  }

  for (const question of openQuestions.slice(0, 1)) {
    keyFacts.push(question.replace(/^gost pitao:\s*/i, "Pita: "));
  }

  const guestOrdered = messages.some(
    (msg) => msg.role === "guest" && ORDER_VERB_PATTERN.test(msg.text)
  );
  if (!mainItem && guestOrdered) {
    const lastOrder = messages
      .filter((msg) => msg.role === "guest" && ORDER_VERB_PATTERN.test(msg.text))
      .at(-1);
    if (lastOrder) {
      keyFacts.push(`Gost naručuje: ${lastOrder.text.slice(0, 60).trim()}`);
    }
  }

  const uniqueFacts = uniqueStrings(keyFacts).slice(0, 5);
  const narrativeParts: string[] = [];

  const orderFact = uniqueFacts.find((fact) => /^Gost traži/i.test(fact));
  if (orderFact) narrativeParts.push(orderFact.endsWith(".") ? orderFact : `${orderFact}.`);

  const dessertFact = uniqueFacts.find((fact) => /desert/i.test(fact));
  if (dessertFact) narrativeParts.push(`${dessertFact}.`);

  const otherFacts = uniqueFacts.filter(
    (fact) => fact !== orderFact && fact !== dessertFact
  );
  for (const fact of otherFacts.slice(0, 2)) {
    narrativeParts.push(fact.endsWith(".") ? fact : `${fact}.`);
  }

  const semanticSummary = narrativeParts.join(" ").slice(0, 180);

  return { keyFacts: uniqueFacts, semanticSummary };
}

function trimToTokenBudget(input: ActiveMemory, maxTokens: number): ActiveMemory {
  const block = formatActiveMemoryBlock(input);
  if (estimateContextTokens(block) <= maxTokens) return input;

  return {
    ...input,
    guestPreferences: input.guestPreferences.slice(0, 4),
    openQuestions: input.openQuestions.slice(0, 2),
    agreedFacts: input.agreedFacts.slice(0, 3),
    keyFacts: input.keyFacts.slice(0, 5),
    semanticSummary: input.semanticSummary.slice(0, 120),
    conversationSummary: input.conversationSummary.slice(0, 120),
  };
}

function mapTimelineMessages(
  timeline: DenisTimelineRow[]
): TimestampedMessage[] {
  return foldTranscriptFromTimeline(timeline)
    .filter((entry) => entry.role === "guest" || entry.role === "denis")
    .map((entry) => ({
      role: entry.role as "guest" | "denis",
      text: entry.text,
      atMs: entry.at ? new Date(entry.at).getTime() : Date.now(),
    }));
}

/** Deterministic active memory — semantic compression + topic graph (Prompt 93). */
export function buildActiveMemory(
  timeline: DenisTimelineRow[],
  maxTokens = DEFAULT_MAX_ACTIVE_MEMORY_TOKENS,
  nowMs = Date.now(),
  conversationGraph: ConversationGraph | null = null
): ActiveMemory | null {
  const timestamped = mapTimelineMessages(timeline);
  const messages: DialogueMessage[] = timestamped.map(({ role, text }) => ({
    role,
    text,
  }));

  if (messages.length <= 10) return null;

  const avgFreshness = averageFreshness(timestamped, nowMs);
  const tailSize = resolveTailSizeWithFreshness(messages.length, avgFreshness);
  const summarized = messages.slice(0, messages.length - tailSize);
  const rawTail = messages.slice(-tailSize);

  const guestTurns = messages.filter((m) => m.role === "guest").length;
  const denisTurns = messages.filter((m) => m.role === "denis").length;

  const preferences = extractPreferences(summarized);
  const agreedFacts = extractAgreedFacts(summarized);
  const openQuestions = extractOpenQuestions(messages);
  const { keyFacts, semanticSummary } = buildSemanticKeyFacts({
    messages: summarized,
    fullMessages: messages,
    preferences,
    agreedFacts,
    openQuestions,
  });

  const fullRawText = messages
    .map((m) => `${m.role === "guest" ? "Guest" : "Denis"}: ${m.text}`)
    .join("\n");

  const lastGuestMessage = [...messages].reverse().find((m) => m.role === "guest");
  const referenceResolution = conversationGraph && lastGuestMessage
    ? resolveGuestReference(conversationGraph, lastGuestMessage.text)
    : null;

  const graphContextBlock = conversationGraph
    ? formatConversationGraphBlock(conversationGraph)
    : "";

  const memory: ActiveMemory = {
    guestPreferences: preferences,
    openQuestions,
    agreedFacts,
    keyFacts,
    semanticSummary,
    moodShift: detectMoodShift(messages),
    conversationSummary:
      semanticSummary ||
      buildDeterministicSummary(summarized, guestTurns, denisTurns),
    tokensSaved: 0,
    rawTail,
    avgFreshness,
    conversationGraph,
    graphContextBlock,
    referenceResolution:
      referenceResolution && referenceResolution.kind !== "none"
        ? `${referenceResolution.kind}:${referenceResolution.detail ?? ""}`
        : null,
  };

  const compactBlock = formatActiveMemoryBlock(memory);
  const compactTokens = estimateContextTokens(compactBlock);
  const rawTailText = rawTail
    .map((m) => `${m.role === "guest" ? "Guest" : "Denis"}: ${m.text}`)
    .join("\n");

  memory.tokensSaved = Math.max(
    0,
    estimateContextTokens(fullRawText) -
      compactTokens -
      estimateContextTokens(rawTailText)
  );

  return trimToTokenBudget(memory, maxTokens);
}

/** Situation Pack block for folded conversation memory. */
export function formatActiveMemoryBlock(memory: ActiveMemory): string {
  const lines = ["AKTIVNO PAMĆENJE:"];

  if (memory.graphContextBlock) {
    lines.push(memory.graphContextBlock);
  }

  if (memory.referenceResolution) {
    lines.push(`- reference: ${memory.referenceResolution}`);
  }

  if (memory.semanticSummary) {
    lines.push(`- Kompresija: ${memory.semanticSummary}`);
  } else if (memory.keyFacts.length > 0) {
    lines.push(`- Ključno: ${memory.keyFacts.join(". ")}`);
  }

  if (memory.guestPreferences.length > 0) {
    lines.push(`- Gost: ${memory.guestPreferences.join(", ")}`);
  }
  if (memory.agreedFacts.length > 0) {
    lines.push(`- Dogovoreno: ${memory.agreedFacts.join("; ")}`);
  }
  if (memory.openQuestions.length > 0) {
    lines.push(`- Otvoreno: ${memory.openQuestions.join("; ")}`);
  }
  if (memory.moodShift) {
    lines.push(`- Mood: ${memory.moodShift}`);
  }
  lines.push(`- freshness: ${memory.avgFreshness.toFixed(2)}`);
  lines.push(`- tokens_saved_vs_raw: ${memory.tokensSaved}`);

  if (lines.length === 1) return "";
  return lines.join("\n");
}

/** Inject L2 guest relationship context alongside session active memory. */
export function formatGuestRelationshipActiveMemoryBlock(
  guestMemory: GuestMemoryProjection | null | undefined
): string {
  if (!guestMemoryPersonalizationAllowed(guestMemory) || !guestMemory) return "";

  const blocks: string[] = [];
  const relationship = formatGuestRelationshipBlock(
    guestMemory,
    guestMemory.language ?? "sr"
  );
  if (relationship) blocks.push(relationship);

  const upsellLines: string[] = ["GUEST UPSELL POLICY:"];
  if (!shouldOfferStarter(guestMemory)) {
    upsellLines.push("- skip_starter: true (guest never orders appetizers)");
  }
  if (shouldOfferDessert(guestMemory)) {
    upsellLines.push("- prioritize_dessert: true");
  }
  if (upsellLines.length > 1) blocks.push(upsellLines.join("\n"));

  return blocks.join("\n\n");
}
