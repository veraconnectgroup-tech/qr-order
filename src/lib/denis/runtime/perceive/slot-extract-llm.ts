import { isOpenAiConfigured } from "@/lib/ai/config";
import { callOpenAiChat } from "@/lib/ai/openai-client";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  OrderSlotsSchema,
  type OrderSlots,
} from "@/lib/denis/runtime/perceive/order-slots.schema";
import { logger } from "@/lib/logger";

function buildSlotExtractMessages(
  utterance: string,
  language: string
): OpenAiChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "Extract order slots only. Output JSON: { items: [{ productNameRaw, quantity, serveSize, notes, confidence }], unmappedSpans: [] }.",
        "No chit-chat. productId always null. quantity integer >= 1.",
        `Language hint: ${language}.`,
      ].join(" "),
    },
    { role: "user", content: utterance },
  ];
}

/** T2 LLM slot extract — optional when heuristic insufficient (M22). */
export async function llmSlotExtract(
  utterance: string,
  language: string,
  config: ConciergeConfig
): Promise<OrderSlots | null> {
  if (!isOpenAiConfigured()) return null;

  const model =
    config.llm.model?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    undefined;

  try {
    const result = await callOpenAiChat(
      buildSlotExtractMessages(utterance, language),
      { model }
    );
    const parsed = JSON.parse(result.content) as {
      items?: Array<{
        productNameRaw?: string | null;
        quantity?: number;
        serveSize?: string | null;
        notes?: string;
        confidence?: number;
      }>;
      unmappedSpans?: string[];
    };

    const items =
      parsed.items?.map((row) => ({
        productId: null,
        productNameRaw:
          typeof row.productNameRaw === "string" ? row.productNameRaw : null,
        quantity:
          typeof row.quantity === "number" && row.quantity > 0
            ? Math.min(99, Math.floor(row.quantity))
            : 1,
        serveSize:
          typeof row.serveSize === "string" ? row.serveSize.slice(0, 40) : null,
        modifierIds: [] as string[],
        notes: typeof row.notes === "string" ? row.notes.slice(0, 200) : "",
        confidence:
          typeof row.confidence === "number"
            ? Math.min(1, Math.max(0, row.confidence))
            : 0.7,
      })) ?? [];

    const slots = OrderSlotsSchema.parse({
      items,
      unmappedSpans: Array.isArray(parsed.unmappedSpans)
        ? parsed.unmappedSpans.filter((s) => typeof s === "string")
        : [],
      tier: "T2_llm",
    });

    return slots.items.length > 0 ? slots : null;
  } catch (error) {
    logger.warn("llmSlotExtract failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
