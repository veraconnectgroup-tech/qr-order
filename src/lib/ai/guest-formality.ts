/**
 * Per-guest, per-session formality override — a guest can ask Denis to drop
 * formal address ("vi") for this table visit only. Deterministic regex
 * detection, not an LLM decision: this only ever loosens address style, has
 * no side effect beyond one session's system prompt, and a false negative
 * just means the guest can phrase it differently — low enough stakes that a
 * heuristic is the right tool, matching the same reasoning already used for
 * `resolveInteractionTone`'s staff-tone classifier.
 *
 * Serbian-focused since that's this platform's primary guest base today —
 * other languages are a documented gap (see Policy Engine plan §3 open
 * questions), not silently guessed at.
 *
 * Text is normalized to plain ASCII before matching (š→s, đ→dj, ć/č→c,
 * ž→z) — JS regex `\b` word boundaries only recognize ASCII word
 * characters, so a diacritic at the end of a word silently breaks `\b`
 * there. Normalizing first also means guests who type without diacritics
 * (very common on phones) match the same patterns.
 */
function normalizeSerbianDiacritics(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, "dj")
    .replace(/[ćč]/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z");
}

const DROP_FORMAL_PATTERNS: RegExp[] = [
  /\bne\s+moras\s+(da\s+)?(mi\s+)?persira(ti|s)\b/,
  /\bnemoj\s+(mi\s+)?(da\s+)?persira(ti|s)\b/,
  /\bprestani\s+(sa\s+)?persira(nj)?em\b/,
  /\bpredjimo\s+na\s+ti\b/,
  /\bhajde\s+na\s+ti\b/,
  /\bmozemo\s+na\s+ti\b/,
  /\bmozes\s+(mi\s+)?(da\s+mi\s+)?(na\s+)?ti\b/,
  /\bobracaj\s+mi\s+se\s+na\s+ti\b/,
  /\bgovori\s+mi\s+ti\b/,
  /\bzovi\s+me\s+na\s+ti\b/,
];

export function detectGuestFormalityDropRequest(message: string): boolean {
  const normalized = normalizeSerbianDiacritics(message.trim());
  if (!normalized) return false;
  return DROP_FORMAL_PATTERNS.some((pattern) => pattern.test(normalized));
}
