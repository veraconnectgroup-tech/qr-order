import {
  mergeAllergieLabelSets,
  parseAllergenExclusionsFromText,
} from "@/lib/denis/kernel/safety/allergy-guard";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { WaiterSessionIntel } from "@/lib/denis/venue/copilot/waiter-copilot-types";

const TOPIC_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(bez\s*gluten\w*|gluten\s*free|glutenfrei)\b/i, label: "bezglutensko" },
  { pattern: /\b(vegan\w*|vegetar\w*)\b/i, label: "vegan/vegetarijansko" },
  { pattern: /\b(račun|racun|bill|rechnung)\b/i, label: "račun" },
  { pattern: /\b(konobar|waiter|kelner|garson)\b/i, label: "konobar" },
  { pattern: /\b(preporuk\w*|recommend|empfehl)\b/i, label: "preporuka" },
];

type DraftItem = { productName?: string; quantity?: number };

function guestMessagesFromTimeline(timeline: DenisTimelineRow[]): string[] {
  const messages: string[] = [];
  for (const row of timeline) {
    const payload = row.payload;
    if (payload.type !== "perception.ingested") continue;
    const text = payload.frame.normalizedText?.trim();
    if (!text) continue;
    if (!payload.frame.channel.includes("chat")) continue;
    messages.push(text);
  }
  return messages.slice(-12);
}

function frustrationFromTimeline(
  timeline: DenisTimelineRow[]
): WaiterSessionIntel["frustrationLevel"] {
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const payload = timeline[i]?.payload;
    if (payload.type === "mental_model.updated") {
      const model = payload.model as { frustrationLevel?: string };
      const level = model.frustrationLevel;
      if (level === "high" || level === "mild" || level === "none") {
        return level;
      }
    }
    if (payload.type === "staff.proactive.alert") {
      if (payload.kind === "staff_frustrated_guest") return "high";
    }
  }
  return "none";
}

function cartSummaryFromDraft(draft: unknown): string | null {
  if (!draft || typeof draft !== "object") return null;
  const items = (draft as { items?: DraftItem[] }).items;
  if (!Array.isArray(items) || items.length === 0) return null;
  return items
    .slice(0, 4)
    .map((item) => `${item.quantity ?? 1}x ${item.productName ?? "?"}`)
    .join(", ");
}

function guestTopicsFromMessages(messages: string[]): string[] {
  const topics = new Set<string>();
  for (const message of messages) {
    for (const { pattern, label } of TOPIC_PATTERNS) {
      if (pattern.test(message)) topics.add(label);
    }
  }
  return [...topics];
}

/** Lightweight session intel for waiter copilot — no full fold. */
export function extractWaiterSessionIntel(input: {
  timeline: DenisTimelineRow[];
  orderDraft?: unknown;
}): WaiterSessionIntel {
  const guestMessages = guestMessagesFromTimeline(input.timeline);
  const allergyLabels = guestMessages.reduce<string[]>(
    (labels, message) =>
      mergeAllergieLabelSets(labels, parseAllergenExclusionsFromText(message)),
    []
  );

  return {
    allergyLabels,
    frustrationLevel: frustrationFromTimeline(input.timeline),
    cartSummary: cartSummaryFromDraft(input.orderDraft),
    guestTopics: guestTopicsFromMessages(guestMessages),
  };
}

export function computeGuestWaitMinutes(input: {
  orders: Array<{ status: string; created_at: string; hasKitchenItems: boolean }>;
  nowMs?: number;
}): number | null {
  const now = input.nowMs ?? Date.now();
  const waiting = input.orders.filter(
    (order) =>
      order.hasKitchenItems &&
      ["pending", "accepted", "preparing"].includes(order.status)
  );
  if (waiting.length === 0) return null;

  const oldest = waiting.reduce((min, order) => {
    const ts = new Date(order.created_at).getTime();
    return ts < min ? ts : min;
  }, Number.POSITIVE_INFINITY);

  if (!Number.isFinite(oldest)) return null;
  return Math.max(0, Math.round((now - oldest) / 60_000));
}
