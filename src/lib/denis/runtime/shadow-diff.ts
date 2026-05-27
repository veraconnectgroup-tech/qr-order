import type {
  ShadowDenisTurn,
  ShadowDiffResult,
  ShadowLegacyTurn,
} from "@/lib/denis/runtime/shadow-types";

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Compare legacy chat output vs Denis kernel plan (M10 shadow mode). */
export function diffShadowTurn(input: {
  legacy: ShadowLegacyTurn;
  denis: ShadowDenisTurn;
}): ShadowDiffResult {
  const matched: string[] = [];
  const mismatches: string[] = [];
  let checks = 0;

  if (input.legacy.intent !== undefined) {
    checks += 1;
    const legacyIntent = norm(input.legacy.intent);
    const denisIntent = norm(input.denis.intent ?? undefined);
    const intentMap: Record<string, string[]> = {
      order: ["order"],
      confirm: ["confirm"],
      clarify: ["clarify_reply"],
      menu_info: ["browse"],
      recommend: ["browse"],
      chat: ["smalltalk", "unknown"],
    };
    const acceptable = intentMap[legacyIntent] ?? [legacyIntent];
    if (acceptable.includes(denisIntent) || denisIntent === legacyIntent) {
      matched.push("intent");
    } else {
      mismatches.push(
        `intent legacy=${input.legacy.intent} denis=${input.denis.intent}`
      );
    }
  }

  if (input.legacy.submitOrder !== undefined) {
    checks += 1;
    const denisSubmit = (input.denis.skillIds ?? []).includes("order.submit");
    if (Boolean(input.legacy.submitOrder) === denisSubmit) {
      matched.push("submit");
    } else {
      mismatches.push(
        `submit legacy=${input.legacy.submitOrder} denis=${denisSubmit}`
      );
    }
  }

  if (input.legacy.cartActionCount !== undefined) {
    checks += 1;
    const denisMutations = (input.denis.skillIds ?? []).filter((id) =>
      id.startsWith("cart.")
    ).length;
    if (input.legacy.cartActionCount === denisMutations) {
      matched.push("cartActions");
    } else {
      mismatches.push(
        `cartActions legacy=${input.legacy.cartActionCount} denis=${denisMutations}`
      );
    }
  }

  if (input.denis.hasConflict !== undefined) {
    checks += 1;
    const legacyConflictHint =
      (input.legacy.message ?? "").toLowerCase().includes("korpi") &&
      (input.legacy.message ?? "").toLowerCase().includes("chatu");
    if (legacyConflictHint === input.denis.hasConflict) {
      matched.push("conflictHint");
    } else if (input.denis.hasConflict) {
      mismatches.push("conflict detected by Denis but not legacy message");
    } else {
      matched.push("conflictHint");
    }
  }

  const parityScore = checks === 0 ? 1 : matched.length / checks;

  return {
    parityScore,
    matched,
    mismatches,
  };
}

export const SHADOW_PARITY_THRESHOLD = 0.99;

export function shadowParityPassed(diff: ShadowDiffResult): boolean {
  return diff.parityScore >= SHADOW_PARITY_THRESHOLD;
}
