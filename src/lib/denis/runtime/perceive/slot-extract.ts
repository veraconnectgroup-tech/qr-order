import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { heuristicSlotExtract } from "@/lib/denis/runtime/perceive/heuristic-slot-extract";
import { llmSlotExtract } from "@/lib/denis/runtime/perceive/slot-extract-llm";
import type { OrderSlots } from "@/lib/denis/runtime/perceive/order-slots.schema";

export type SlotExtractInput = {
  utterance: string;
  language: string;
  config: ConciergeConfig;
};

/**
 * M22 — T2 order slot extraction (heuristic first, optional LLM).
 * Does not mutate cart — shadow/timeline signal until act layer wires ACL.
 */
export async function extractOrderSlots(
  input: SlotExtractInput
): Promise<OrderSlots | null> {
  const heuristic = heuristicSlotExtract(input.utterance);
  if (heuristic.items.length > 0) {
    return heuristic;
  }

  if (!input.config.llm.slotExtractWithLlm) {
    return heuristic.tier === "none" ? null : heuristic;
  }

  const llm = await llmSlotExtract(
    input.utterance,
    input.language,
    input.config
  );
  return llm ?? null;
}
