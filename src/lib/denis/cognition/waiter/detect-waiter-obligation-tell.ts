import { formatOrderRecapLines } from "@/lib/ai/ordering/order-flow";
import { initDraftFromStorage } from "@/lib/ai/ordering/draft-engine";
import { enforceWaiterTell } from "@/lib/denis/cognition/waiter/enforce-waiter-tell";
import type { GuestProactiveNudge } from "@/lib/denis/cognition/proactive/proactive-types";
import type { TableSessionState } from "@/lib/denis/loop/types";
import { waiterGapTemplateKey } from "@/lib/denis/cognition/waiter/assess-waiter-obligation";

function cartDraftFromState(state: TableSessionState) {
  const base = initDraftFromStorage(null);
  return {
    ...base,
    items: state.commerce.cart.ai.draft.items.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      serveSize: line.serveSize,
      modifierIds: [...line.modifierIds],
      notes: line.notes,
      lineTotal: line.lineTotal,
      menuSection: (line.menuSection ?? "food") as "food" | "drinks",
      productTaxRate: line.productTaxRate ?? null,
    })),
  };
}

function obligationAlreadyVoiced(
  state: TableSessionState,
  gapPrompt: string
): boolean {
  const prompt = gapPrompt.trim().toLowerCase();
  if (!prompt) return false;

  const lastDenis = state.conversation.model.thread.lastDenisText?.trim().toLowerCase();
  if (lastDenis?.includes(prompt.slice(0, 24))) return true;

  return state.conversation.model.transcript.some(
    (entry) =>
      entry.role === "denis" &&
      entry.text.trim().toLowerCase().includes(prompt.slice(0, 24))
  );
}

/**
 * ADR-032 §3 — Denis writes gap clarify without guest turn (Viktor-style state mirror).
 * Highest priority over welcome/upsell when cart has holes.
 */
export function detectWaiterObligationTell(
  state: TableSessionState,
  language: string
): GuestProactiveNudge | null {
  const obligation = state.conversation.obligation;
  if (!obligation?.gaps.length) return null;

  const primary = obligation.gaps[0];
  if (obligationAlreadyVoiced(state, primary.prompt)) return null;

  const draft = cartDraftFromState(state);
  const recapLines = formatOrderRecapLines(draft);
  const recapPrefix =
    recapLines.length > 0
      ? language.startsWith("de")
        ? `Aktuell: ${recapLines.join(", ")}.`
        : language.startsWith("en")
          ? `So far: ${recapLines.join(", ")}.`
          : `Za sada: ${recapLines.join(", ")}.`
      : "";

  const message = enforceWaiterTell({
    message: recapPrefix,
    obligation,
    language,
    draft,
  }).trim();

  if (!message) return null;

  return {
    kind: "waiter_gap",
    message,
    prompt: primary.prompt,
  };
}

export function waiterObligationDedupeKey(
  state: TableSessionState
): string {
  const gap = state.conversation.obligation?.primaryGap ?? "generic";
  return `waiter_gap:${gap}`;
}

export function waiterObligationTemplateKey(
  state: TableSessionState
): string {
  return waiterGapTemplateKey(state.conversation.obligation?.primaryGap ?? null);
}
