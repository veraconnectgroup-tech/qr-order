import type { CartConflict } from "@/lib/denis/kernel/conflict/types";

function uniqueNames(lines: Array<{ productName: string }>): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of lines) {
    const name = line.productName.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} i ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} i ${names[names.length - 1]}`;
}

/** One-shot guest question template (T3 receives this as fact). */
export function buildConflictGuestPrompt(conflicts: CartConflict[]): string | null {
  if (conflicts.length === 0) return null;

  const manualOnly = conflicts
    .filter((c): c is Extract<CartConflict, { kind: "manual_only" }> => c.kind === "manual_only")
    .map((c) => c.line);
  const aiOnly = conflicts
    .filter((c): c is Extract<CartConflict, { kind: "ai_only" }> => c.kind === "ai_only")
    .map((c) => c.line);

  if (manualOnly.length > 0 && aiOnly.length > 0) {
    const manualNames = joinNames(uniqueNames(manualOnly));
    const aiNames = joinNames(uniqueNames(aiOnly));
    return `Vidim ${manualNames} u korpi i ${aiNames} u chatu — da pošaljem oboje kao jednu narudžbinu?`;
  }

  if (manualOnly.length > 0) {
    const names = joinNames(uniqueNames(manualOnly));
    return `U korpi imate ${names} — da uključim to u narudžbinu?`;
  }

  if (aiOnly.length > 0) {
    const names = joinNames(uniqueNames(aiOnly));
    return `U chatu imate ${names}, ali nije u korpi — da dodam?`;
  }

  const duplicate = conflicts.find((c) => c.kind === "duplicate_line");
  if (duplicate && duplicate.kind === "duplicate_line") {
    return `Za ${duplicate.manual.productName} imate ${duplicate.manual.quantity} u korpi, a u chatu ${duplicate.ai.quantity} — koliko šaljemo?`;
  }

  const drift = conflicts.find((c) => c.kind === "price_drift");
  if (drift && drift.kind === "price_drift") {
    return `Cena za ${drift.productName} se promenila — da nastavimo sa trenutnom cenom?`;
  }

  return "Korpa i chat se ne slažu — da spojim u jednu narudžbinu?";
}

export function buildConflictSummary(conflicts: CartConflict[]): string {
  if (conflicts.length === 0) return "cart_in_sync";
  const kinds = [...new Set(conflicts.map((c) => c.kind))];
  return kinds.join("+");
}
