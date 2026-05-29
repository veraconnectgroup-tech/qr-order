/** Deterministic return-guest welcome — T0, no LLM (ADR-005 §7.2). */
export function buildReturnGuestWelcomeMessage(input: {
  language: string;
  lastVisitItems: string[];
  visitCount: number;
  template?: string | null;
}): string | null {
  const items = input.lastVisitItems.filter(Boolean).slice(0, 4);
  if (input.visitCount < 1 || items.length === 0) return null;

  const itemsText = items.join(", ");

  if (input.template?.includes("{items}")) {
    return input.template.replace("{items}", itemsText);
  }

  const lang = input.language.toLowerCase().slice(0, 2);
  if (lang === "de") {
    return `Willkommen zurück! Beim letzten Mal: ${itemsText} — darf ich das wieder für Sie bringen?`;
  }
  if (lang === "en") {
    return `Welcome back! Last time you had ${itemsText} — shall I bring that again?`;
  }
  return `Dobrodošli nazad! Prošli put ste imali ${itemsText} — da ponovo to isto?`;
}
