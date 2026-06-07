import type { AiOrderDraft } from "@/lib/ai/ordering/draft-types";
import { appendOrderGapClarify } from "@/lib/ai/ordering/order-message-backfill";
import type { WaiterObligation } from "@/lib/denis/cognition/waiter/waiter-obligation-types";

function obligationToBackfillMeta(obligation: WaiterObligation) {
  const drinkGap = obligation.gaps.some((g) => g.kind === "drink_unspecified");
  const subGap = obligation.gaps.find((g) => g.kind === "substitution_note");
  return {
    needsDrinkClarify: drinkGap,
    substitution: subGap
      ? {
          requested: "",
          insteadOf: "",
          rawPhrase: subGap.prompt,
        }
      : null,
  };
}

/** Ensure TELL never omits active waiter gaps (ADR-032). */
export function enforceWaiterTell(input: {
  message: string;
  obligation: WaiterObligation;
  language: string;
  draft: AiOrderDraft;
}): string {
  if (!input.obligation.gaps.length) return input.message;

  const base = input.message.trim() || input.obligation.inCart.join("\n");
  const meta = obligationToBackfillMeta(input.obligation);

  if (!meta.needsDrinkClarify && !meta.substitution) {
    const prompts = input.obligation.gaps.map((gap) => gap.prompt).filter(Boolean);
    if (!prompts.length) return input.message;
    return [base, ...prompts].filter(Boolean).join("\n");
  }

  return appendOrderGapClarify(base, input.language, input.draft, {
    needsDrinkClarify: meta.needsDrinkClarify,
    substitution: null,
  });
}
