import type { AiOrderDraft } from "@/lib/ai/ordering/draft-types";
import type { WaiterObligation } from "@/lib/denis/cognition/waiter/waiter-obligation-types";

/** Ensure TELL never omits active waiter gaps — LLM handles clarify via evidence, not appended templates. */
export function enforceWaiterTell(input: {
  message: string;
  obligation: WaiterObligation;
  language: string;
  draft: AiOrderDraft;
}): string {
  return input.message.trim() || input.obligation.inCart.join("\n");
}
