/** Non-linear conversation topics — Prompt 93. */

export type TopicCompletionStatus =
  | "not_started"
  | "in_progress"
  | "ordered"
  | "completed";

export type ConversationTopicNode = {
  id: string;
  label: string;
  children: string[];
  status: TopicCompletionStatus;
  /** One-sentence compression for context window. */
  summary: string | null;
  lastDenisRecommendation: string | null;
  firstMentionedItem: string | null;
  lastGuestOrderLine: string | null;
  priceHint: string | null;
};

export type ConversationGraphEdge = {
  fromTopicId: string;
  toTopicId: string;
  reason: string;
  atTurn: number;
};

export type ConversationGraph = {
  topics: ConversationTopicNode[];
  activeTopicId: string | null;
  edges: ConversationGraphEdge[];
  turnCount: number;
};

export type ReferenceResolutionKind =
  | "active_topic_price"
  | "topic_switch"
  | "clone_for_friend"
  | "first_mentioned"
  | "cheaper_variant"
  | "last_denis_recommendation"
  | "none";

export type ReferenceResolution = {
  kind: ReferenceResolutionKind;
  topicId: string | null;
  detail: string | null;
};

export const CONVERSATION_TOPIC_IDS = {
  allergies: "allergies",
  drinks: "drinks",
  dessert: "dessert",
  burger: "burger",
  food: "food",
  bill: "bill",
} as const;

const DEFAULT_TOPICS: ConversationTopicNode[] = [
  {
    id: CONVERSATION_TOPIC_IDS.allergies,
    label: "Alergije",
    children: [],
    status: "not_started",
    summary: null,
    lastDenisRecommendation: null,
    firstMentionedItem: null,
    lastGuestOrderLine: null,
    priceHint: null,
  },
  {
    id: CONVERSATION_TOPIC_IDS.burger,
    label: "Burger",
    children: [],
    status: "not_started",
    summary: null,
    lastDenisRecommendation: null,
    firstMentionedItem: null,
    lastGuestOrderLine: null,
    priceHint: null,
  },
  {
    id: CONVERSATION_TOPIC_IDS.food,
    label: "Hrana",
    children: [],
    status: "not_started",
    summary: null,
    lastDenisRecommendation: null,
    firstMentionedItem: null,
    lastGuestOrderLine: null,
    priceHint: null,
  },
  {
    id: CONVERSATION_TOPIC_IDS.drinks,
    label: "Piće",
    children: [],
    status: "not_started",
    summary: null,
    lastDenisRecommendation: null,
    firstMentionedItem: null,
    lastGuestOrderLine: null,
    priceHint: null,
  },
  {
    id: CONVERSATION_TOPIC_IDS.dessert,
    label: "Desert",
    children: [],
    status: "not_started",
    summary: null,
    lastDenisRecommendation: null,
    firstMentionedItem: null,
    lastGuestOrderLine: null,
    priceHint: null,
  },
  {
    id: CONVERSATION_TOPIC_IDS.bill,
    label: "Račun",
    children: [],
    status: "not_started",
    summary: null,
    lastDenisRecommendation: null,
    firstMentionedItem: null,
    lastGuestOrderLine: null,
    priceHint: null,
  },
];

export function emptyConversationGraph(): ConversationGraph {
  return {
    topics: DEFAULT_TOPICS.map((topic) => ({ ...topic, children: [] })),
    activeTopicId: null,
    edges: [],
    turnCount: 0,
  };
}

export function getTopic(
  graph: ConversationGraph,
  topicId: string
): ConversationTopicNode | undefined {
  return graph.topics.find((topic) => topic.id === topicId);
}

export function getActiveTopic(
  graph: ConversationGraph
): ConversationTopicNode | undefined {
  if (!graph.activeTopicId) return undefined;
  return getTopic(graph, graph.activeTopicId);
}

function uniqueChildren(children: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const child of children) {
    const key = child.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(child.trim());
  }
  return out;
}

export function upsertTopicChild(
  topic: ConversationTopicNode,
  child: string
): ConversationTopicNode {
  const trimmed = child.trim();
  if (!trimmed) return topic;
  const children = uniqueChildren([...topic.children, trimmed]);
  return {
    ...topic,
    children,
    firstMentionedItem: topic.firstMentionedItem ?? trimmed,
    status: topic.status === "not_started" ? "in_progress" : topic.status,
  };
}

export function summarizeTopic(topic: ConversationTopicNode): string {
  if (topic.summary) return topic.summary;
  if (topic.children.length === 0) {
    return `${topic.label}: nije započeto`;
  }
  const childPart = topic.children.slice(0, 4).join(", ");
  const statusLabel =
    topic.status === "ordered" || topic.status === "completed"
      ? "naručeno"
      : topic.status === "in_progress"
        ? "u toku"
        : "nije započeto";
  return `${topic.label} (${statusLabel}): ${childPart}`;
}

export function buildTopicCompletionPrompt(graph: ConversationGraph): string | null {
  const ordered = graph.topics.filter(
    (topic) => topic.status === "ordered" || topic.status === "completed"
  );
  const pending = graph.topics.filter(
    (topic) =>
      topic.status === "not_started" || topic.status === "in_progress"
  );

  if (ordered.length === 0 && pending.length === 0) return null;

  const parts: string[] = [];
  if (ordered.length > 0) {
    parts.push(
      `Izabrali ste ${ordered.map((topic) => topic.label).join(", ")}.`
    );
  }
  const next = pending.find((topic) => topic.id !== CONVERSATION_TOPIC_IDS.bill);
  if (next) {
    parts.push(`${next.label}?`);
  }
  return parts.join(" ") || null;
}
