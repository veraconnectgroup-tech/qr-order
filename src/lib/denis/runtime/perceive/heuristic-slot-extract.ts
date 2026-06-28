import type { OrderSlotItem, OrderSlots } from "@/lib/denis/runtime/perceive/order-slots.schema";
import { parseOrderQuantityToken } from "@/lib/denis/cognition/conversation/parse-order-quantity";

const SPLIT_RE = /\s*(?:,| und | and | i | oraz | plus |\+)\s*/i;

function normalizeUtterance(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function parseQuantityToken(token: string): number | null {
  return parseOrderQuantityToken(token);
}

function parseClause(clause: string): OrderSlotItem | null {
  const trimmed = clause.trim();
  if (!trimmed || trimmed.length < 2) return null;

  const numericPrefix = trimmed.match(/^(\d{1,2})\s*[x×]?\s+(.+)$/i);
  if (numericPrefix) {
    const name = numericPrefix[2]?.trim();
    if (!name) return null;
    return {
      productId: null,
      productNameRaw: name,
      quantity: Number.parseInt(numericPrefix[1]!, 10),
      serveSize: null,
      modifierIds: [],
      notes: "",
      confidence: 0.85,
    };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const qty = parseQuantityToken(parts[0]!);
    if (qty != null) {
      const name = parts.slice(1).join(" ").trim();
      if (name.length >= 2) {
        return {
          productId: null,
          productNameRaw: name,
          quantity: qty,
          serveSize: null,
          modifierIds: [],
          notes: "",
          confidence: 0.8,
        };
      }
    }
  }

  if (trimmed.length >= 3 && !/^(da|ne|ok|yes|no)$/i.test(trimmed)) {
    return {
      productId: null,
      productNameRaw: trimmed,
      quantity: 1,
      serveSize: null,
      modifierIds: [],
      notes: "",
      confidence: 0.55,
    };
  }

  return null;
}

/** T0-heavy slot parse — no LLM (M22). */
export function heuristicSlotExtract(utterance: string): OrderSlots {
  const normalized = normalizeUtterance(utterance);
  const clauses = normalized.split(SPLIT_RE).map((part) => part.trim()).filter(Boolean);
  const items: OrderSlotItem[] = [];
  const unmappedSpans: string[] = [];

  for (const clause of clauses) {
    const item = parseClause(clause);
    if (item) {
      items.push(item);
    } else if (clause.length > 1) {
      unmappedSpans.push(clause);
    }
  }

  return {
    items,
    unmappedSpans,
    tier: items.length > 0 ? "T0_heuristic" : "none",
  };
}
