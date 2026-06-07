import type { AiOrderDraft } from "@/lib/ai/ordering/draft-types";
import {
  appendOrderGapClarify,
  draftHasDrinkInCart,
} from "@/lib/ai/ordering/order-message-backfill";
import type { WaiterObligation } from "@/lib/denis/cognition/waiter/waiter-obligation-types";

/** Ensure TELL never omits active waiter gaps (ADR-032). */
export function enforceWaiterTell(input: {
  message: string;
  obligation: WaiterObligation;
  language: string;
  draft: AiOrderDraft;
}): string {
  if (!input.obligation.gaps.length) return input.message;

  const base = input.message.trim() || input.obligation.inCart.join("\n");
  const drinkGap = input.obligation.gaps.some(
    (gap) => gap.kind === "drink_unspecified"
  );

  let message = base;
  if (drinkGap && !draftHasDrinkInCart(input.draft)) {
    message = appendOrderGapClarify(message, input.language, input.draft, {
      needsDrinkClarify: true,
      substitution: null,
    });
  }

  const otherPrompts = input.obligation.gaps
    .filter((gap) => gap.kind !== "drink_unspecified")
    .map((gap) => gap.prompt)
    .filter(Boolean);

  if (!otherPrompts.length) return message;
  return [message, ...otherPrompts].filter(Boolean).join("\n");
}
