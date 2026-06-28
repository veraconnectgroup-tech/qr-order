import type { PosOrderPayload } from "@/lib/pos/types";
import { getPosAdapter } from "@/lib/pos/adapter-registry";

export type PushFinalPosOrderInput = {
  provider: string;
  config: Record<string, unknown>;
  payload: PosOrderPayload;
};

/** Outbound — confirmed Denis order pushed to POS (direct adapter path). */
export async function pushFinalOrderToPos(input: PushFinalPosOrderInput) {
  const adapter = getPosAdapter(input.provider);
  if (!adapter) {
    return {
      success: false,
      skipped: true,
      error: `no_adapter:${input.provider}`,
    };
  }

  return adapter.pushOrder(input.payload, {
    ...input.config,
    provisional: false,
  });
}
