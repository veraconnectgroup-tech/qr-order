import {
  buildTopicCompletionPrompt,
  CONVERSATION_TOPIC_IDS,
  emptyConversationGraph,
  getActiveTopic,
  getTopic,
  summarizeTopic,
  upsertTopicChild,
  type ConversationGraph,
  type ConversationTopicNode,
  type ReferenceResolution,
  type TopicCompletionStatus,
} from "@/lib/denis/cognition/conversation/conversation-graph";
import { collectTurnInterpretationsFromTimeline } from "@/lib/denis/cognition/tde/extract-turn-interpretation";
import {
  isGuestCopyOrderMessage,
  isGuestDeclineMessage,
  isGuestModificationMessage,
  isGuestPriceInquiryMessage,
} from "@/lib/denis/cognition/tde/semantic-intent-router";
import type { TurnInterpretation } from "@/lib/denis/cognition/tde/turn-interpretation-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

type DialogueMessage = { role: "guest" | "denis"; text: string };

const ORDER_CONFIRM_PATTERN =
  /\b(da|može|potvrđujem|confirm|yes|ja\s+bitte)\b/i;

const ORDER_VERB_PATTERN =
  /\b(daj|naruč|naruc|hoću|hocu|want|order|bestell|1x|2x|\d+\s*x)\b/i;

const TOPIC_DETECTORS: Array<{
  id: string;
  pattern: RegExp;
  childExtractor?: (text: string, interpretation?: TurnInterpretation | null) => string | null;
}> = [
  {
    id: CONVERSATION_TOPIC_IDS.burger,
    pattern: /\bburger\b/i,
    childExtractor: (text, interpretation) => {
      if (interpretation?.cookingPreference) return interpretation.cookingPreference;
      if (interpretation?.modifications.some((m) => m.cooking)) {
        return interpretation.modifications.find((m) => m.cooking)?.cooking ?? null;
      }
      const withoutMatch = text.match(/\bbez\s+([\p{L}\s]{2,24})/iu);
      if (withoutMatch?.[1]) return `bez ${withoutMatch[1].trim()}`;
      const cookingMatch = text.match(/\b(medium\s+rare|rare|well\s+done)\b/i);
      if (cookingMatch?.[1]) return cookingMatch[1].toLowerCase();
      if (/\bcena\b/i.test(text)) return "cena";
      return null;
    },
  },
  {
    id: CONVERSATION_TOPIC_IDS.food,
    pattern: /\b(ćevap|pizza|pasta|steak|salat[a]?)\b/i,
  },
  {
    id: CONVERSATION_TOPIC_IDS.drinks,
    pattern: /\b(pivo|piće|pić[ae]|beer|pilsner|weizen|cola|vino|wine|radler)\b/i,
    childExtractor: (text) => {
      const match = text.match(
        /\b(pilsner|weizen|radler|cola|vino|pivo|beer)\b/i
      );
      return match?.[1]?.toLowerCase() ?? null;
    },
  },
  {
    id: CONVERSATION_TOPIC_IDS.dessert,
    pattern: /\b(desert|dessert|torta|palačink|slatki|kolač)\b/i,
  },
  {
    id: CONVERSATION_TOPIC_IDS.allergies,
    pattern:
      /\b(alerg|gluten|orah|orasi|nuts|allerg|bez\s+(glutena|oraha|orasi|mleka|laktoze))\b/i,
    childExtractor: (_text, interpretation) => {
      const fromPrefs = interpretation?.preferences[0];
      if (fromPrefs) return fromPrefs.toLowerCase();
      const fromRemove = interpretation?.modifications.find((m) => m.remove)?.remove;
      if (fromRemove) return fromRemove.toLowerCase();
      const fromModifier = interpretation?.modifications.find((m) => m.modifier)?.modifier;
      if (fromModifier) return fromModifier.toLowerCase();
      const text = _text.toLowerCase();
      const allergen = text.match(/\b(gluten|orah|orasi|nuts|mleko|laktoz[a-z]*)\b/i);
      return allergen?.[1]?.toLowerCase() ?? null;
    },
  },
  {
    id: CONVERSATION_TOPIC_IDS.bill,
    pattern: /\b(račun|racun|platiti|bill|pay|rechnung)\b/i,
  },
];

function detectTopicId(text: string): string | null {
  for (const detector of TOPIC_DETECTORS) {
    if (detector.pattern.test(text)) return detector.id;
  }
  return null;
}

function allergyChildrenFromInterpretation(
  interpretation: TurnInterpretation | null | undefined
): string[] {
  if (!interpretation) return [];
  const children: string[] = [];
  for (const pref of interpretation.preferences) {
    children.push(pref.toLowerCase());
  }
  for (const mod of interpretation.modifications) {
    if (mod.remove) children.push(mod.remove.toLowerCase());
    if (mod.modifier) children.push(mod.modifier.toLowerCase());
  }
  return children;
}

function extractTopicChildren(
  topicId: string,
  text: string,
  interpretation?: TurnInterpretation | null
): string[] {
  const detector = TOPIC_DETECTORS.find((row) => row.id === topicId);
  const children: string[] = [];
  if (detector?.childExtractor) {
    const extracted = detector.childExtractor(text, interpretation);
    if (extracted) children.push(extracted);
  }

  if (topicId === CONVERSATION_TOPIC_IDS.burger) {
    if (interpretation?.cookingPreference) {
      children.push(interpretation.cookingPreference);
    }
    if (isGuestPriceInquiryMessage(text)) children.push("cena");
  }

  if (topicId === CONVERSATION_TOPIC_IDS.drinks) {
    const weizen = text.match(/\b(da\s+li\s+imate\s+)?weizen\b/i);
    if (weizen) children.push("da li imate Weizen");
    const pils = text.match(/\bpilsner\b/i);
    if (pils) children.push("Pilsner");
  }

  if (topicId === CONVERSATION_TOPIC_IDS.allergies) {
    children.push(...allergyChildrenFromInterpretation(interpretation));
  }

  return [...new Set(children.filter(Boolean))];
}

function setTopicStatus(
  topic: ConversationTopicNode,
  status: TopicCompletionStatus
): ConversationTopicNode {
  return { ...topic, status };
}

function switchActiveTopic(
  graph: ConversationGraph,
  toTopicId: string,
  reason: string,
  atTurn: number
): ConversationGraph {
  const fromTopicId = graph.activeTopicId;
  if (fromTopicId === toTopicId) return graph;

  const edges = [...graph.edges];
  if (fromTopicId) {
    edges.push({ fromTopicId, toTopicId, reason, atTurn });
  }

  return { ...graph, activeTopicId: toTopicId, edges };
}

function applyDenisPriceHint(
  graph: ConversationGraph,
  text: string
): ConversationGraph {
  const active = graph.activeTopicId ? getTopic(graph, graph.activeTopicId) : null;
  if (!active) return graph;

  const priceMatch = text.match(/(\d+[,.]?\d*)\s*€|(\d+)\s*eur/i);
  if (!priceMatch) return graph;

  const price = priceMatch[0];
  const topics = graph.topics.map((topic) =>
    topic.id === active.id
      ? {
          ...topic,
          priceHint: price,
          children: upsertTopicChild(topic, "cena").children,
        }
      : topic
  );
  return { ...graph, topics };
}

function markTopicOrdered(
  graph: ConversationGraph,
  topicId: string,
  orderLine: string | null
): ConversationGraph {
  const topics = graph.topics.map((topic) => {
    if (topic.id !== topicId) return topic;
    return {
      ...setTopicStatus(topic, "ordered"),
      lastGuestOrderLine: orderLine ?? topic.lastGuestOrderLine,
      summary: summarizeTopic({
        ...topic,
        status: "ordered",
        lastGuestOrderLine: orderLine ?? topic.lastGuestOrderLine,
      }),
    };
  });
  return { ...graph, topics };
}

function guestInterpretationsByTurn(
  timeline?: DenisTimelineRow[]
): TurnInterpretation[] {
  if (!timeline?.length) return [];
  return collectTurnInterpretationsFromTimeline(timeline).map(
    (row) => row.interpretation
  );
}

/** Fold linear transcript into topic graph. */
export function foldConversationGraph(
  messages: DialogueMessage[],
  timeline?: DenisTimelineRow[]
): ConversationGraph {
  let graph = emptyConversationGraph();
  let turn = 0;
  let lastDenisRecommendation: string | null = null;
  let guestTurnIndex = 0;
  const guestInterpretations = guestInterpretationsByTurn(timeline);

  for (const msg of messages) {
    turn += 1;
    graph = { ...graph, turnCount: turn };

    if (msg.role === "denis") {
      if (/\b(preporuč|predlaž|imamo|pilsner|weizen|burger)\b/i.test(msg.text)) {
        lastDenisRecommendation = msg.text.slice(0, 120).trim();
      }
      graph = applyDenisPriceHint(graph, msg.text);

      const active = graph.activeTopicId ? getTopic(graph, graph.activeTopicId) : null;
      if (active && lastDenisRecommendation) {
        const topics = graph.topics.map((topic) =>
          topic.id === active.id
            ? { ...topic, lastDenisRecommendation }
            : topic
        );
        graph = { ...graph, topics };
      }
      continue;
    }

    const interpretation = guestInterpretations[guestTurnIndex] ?? null;
    guestTurnIndex += 1;

    const detectedTopic = detectTopicId(msg.text);
    let targetTopicId = graph.activeTopicId;

    if (detectTopicId(msg.text) === CONVERSATION_TOPIC_IDS.drinks) {
      targetTopicId = CONVERSATION_TOPIC_IDS.drinks;
      graph = switchActiveTopic(graph, targetTopicId, "guest_drink_switch", turn);
    } else if (detectedTopic) {
      targetTopicId = detectedTopic;
      graph = switchActiveTopic(graph, targetTopicId, "guest_topic_mention", turn);
    } else if (isGuestPriceInquiryMessage(msg.text) && graph.activeTopicId) {
      targetTopicId = graph.activeTopicId;
    }

    if (!targetTopicId && detectedTopic) {
      targetTopicId = detectedTopic;
      graph = switchActiveTopic(graph, targetTopicId, "guest_topic_mention", turn);
    }

    if (targetTopicId) {
      const children = extractTopicChildren(targetTopicId, msg.text, interpretation);
      const topics = graph.topics.map((topic) => {
        if (topic.id !== targetTopicId) return topic;
        let next = topic;
        for (const child of children) {
          next = upsertTopicChild(next, child);
        }
        if (ORDER_VERB_PATTERN.test(msg.text)) {
          next = {
            ...next,
            lastGuestOrderLine:
              interpretation?.agreedOrderLine ??
              msg.text.slice(0, 80).trim(),
            status:
              next.status === "ordered" || next.status === "completed"
                ? next.status
                : "in_progress",
          };
        }
        if (
          ORDER_CONFIRM_PATTERN.test(msg.text) &&
          (next.status === "in_progress" ||
            next.lastGuestOrderLine ||
            /\b(potvr|recap|burger|pivo)\b/i.test(
              messages[turn - 2]?.text ?? ""
            ))
        ) {
          next = setTopicStatus(next, "ordered");
        }
        next = {
          ...next,
          summary: summarizeTopic(next),
        };
        return next;
      });
      graph = { ...graph, topics, activeTopicId: targetTopicId };
    }

    if (
      ORDER_CONFIRM_PATTERN.test(msg.text) &&
      graph.activeTopicId &&
      messages[turn - 2]?.role === "denis" &&
      /\b(potvr|recap|burger|pivo)\b/i.test(messages[turn - 2]!.text)
    ) {
      graph = markTopicOrdered(
        graph,
        graph.activeTopicId,
        messages[turn - 3]?.role === "guest"
          ? messages[turn - 3]!.text.slice(0, 80)
          : null
      );
    }
  }

  return graph;
}

export function resolveGuestReference(
  graph: ConversationGraph,
  guestMessage: string,
  interpretation?: TurnInterpretation | null
): ReferenceResolution {
  const text = guestMessage.trim();
  const active = getActiveTopic(graph);

  if (
    interpretation?.guestReferenceKind &&
    interpretation.guestReferenceKind !== "none"
  ) {
    return {
      kind: interpretation.guestReferenceKind,
      topicId: active?.id ?? null,
      detail: interpretation.guestReferenceDetail ?? null,
    };
  }

  if (isGuestCopyOrderMessage(text)) {
    const line = active?.lastGuestOrderLine ?? active?.firstMentionedItem;
    return {
      kind: "clone_for_friend",
      topicId: active?.id ?? null,
      detail: line ? `Clone order: ${line}` : "Clone last order for friend",
    };
  }

  if (isGuestDeclineMessage(text)) {
    return { kind: "none", topicId: active?.id ?? null, detail: null };
  }

  if (isGuestModificationMessage(text)) {
    return { kind: "none", topicId: active?.id ?? null, detail: null };
  }

  if (detectTopicId(text) === CONVERSATION_TOPIC_IDS.drinks) {
    return {
      kind: "topic_switch",
      topicId: CONVERSATION_TOPIC_IDS.drinks,
      detail: "Piće",
    };
  }

  if (isGuestPriceInquiryMessage(text) && active) {
    return {
      kind: "active_topic_price",
      topicId: active.id,
      detail: active.priceHint
        ? `${active.label} price: ${active.priceHint}`
        : `${active.label} price inquiry`,
    };
  }

  if (/^(prvo|first|the first one)\b/i.test(text) && active?.firstMentionedItem) {
    return {
      kind: "first_mentioned",
      topicId: active.id,
      detail: active.firstMentionedItem,
    };
  }

  return { kind: "none", topicId: active?.id ?? null, detail: null };
}

export function trackActiveTopicForMessage(
  graph: ConversationGraph,
  guestMessage: string,
  turnIndex: number,
  interpretation?: TurnInterpretation | null
): ConversationGraph {
  const resolution = resolveGuestReference(graph, guestMessage, interpretation);
  if (resolution.kind === "topic_switch" && resolution.topicId) {
    return switchActiveTopic(
      graph,
      resolution.topicId,
      "reference_topic_switch",
      turnIndex
    );
  }
  if (detectTopicId(guestMessage)) {
    const topicId = detectTopicId(guestMessage)!;
    return switchActiveTopic(graph, topicId, "guest_topic_mention", turnIndex);
  }
  return graph;
}

export function formatConversationGraphBlock(graph: ConversationGraph): string {
  const active = getActiveTopic(graph);
  const allergies = getTopic(graph, CONVERSATION_TOPIC_IDS.allergies);
  const lines = ["CONVERSATION GRAPH:"];

  if (active) {
    lines.push(
      `- active_topic: ${active.label} [${active.status}]${active.priceHint ? ` (price ${active.priceHint})` : ""}`
    );
    if (active.children.length > 0) {
      lines.push(`- active_children: ${active.children.join(" → ")}`);
    }
  }

  if (allergies && allergies.children.length > 0) {
    lines.push(`- alergije (always): ${allergies.children.join(", ")}`);
  }

  for (const topic of graph.topics) {
    if (topic.id === graph.activeTopicId) continue;
    if (topic.id === CONVERSATION_TOPIC_IDS.allergies) continue;
    if (topic.status === "not_started" && topic.children.length === 0) continue;
    lines.push(`- ${summarizeTopic(topic)}`);
  }

  const completion = buildTopicCompletionPrompt(graph);
  if (completion) {
    lines.push(`- completion_hint: ${completion}`);
  }

  return lines.join("\n");
}

export function buildTopicInterpretationDirective(input: {
  graph: ConversationGraph | null | undefined;
  guestMessage: string;
  interpretation?: TurnInterpretation | null;
}): string | null {
  if (!input.graph) return null;
  const resolution = resolveGuestReference(
    input.graph,
    input.guestMessage,
    input.interpretation
  );
  const block = formatConversationGraphBlock(input.graph);
  const lines = [block];

  if (resolution.kind !== "none" && resolution.detail) {
    lines.push(
      `TOPIC REFERENCE: ${resolution.kind} → ${resolution.detail}`
    );
  }

  return lines.join("\n");
}
