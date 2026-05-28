import type { NarrationFacts } from "@/lib/denis/runtime/narrate/narration-facts.schema";

/** True when T3 should speak committed cart/order/ops facts instead of free chat. */
export function hasCommittedNarrationFacts(facts: NarrationFacts): boolean {
  const c = facts.committed;
  return Boolean(
    c.cartSummary ||
    (c.addedItems && c.addedItems.length > 0) ||
    c.orderNumber != null ||
    c.blockedReason ||
    c.handoffMessage ||
    c.conflictQuestion ||
    c.staffHint ||
    c.opsEmpathyNote ||
    c.returnGuestWelcome ||
    c.statusSummary ||
    c.pairingSuggestion
  );
}

export function shouldKeepLegacyConversationReply(
  facts: NarrationFacts,
  legacyMessage: string
): boolean {
  if (!legacyMessage.trim()) return false;
  return !hasCommittedNarrationFacts(facts);
}
