import type {
  PosAdapter,
  PosDeliveryResult,
  PosOrderPayload,
} from "@/lib/pos/types";

/** Shared skeleton for POS providers not yet fully integrated (Prompt 39). */
export class SkeletonPosAdapter implements PosAdapter {
  constructor(public readonly provider: string) {}

  async pushOrder(
    _payload: PosOrderPayload,
    _config: Record<string, unknown>
  ): Promise<PosDeliveryResult> {
    return {
      success: false,
      skipped: true,
      error: `${this.provider}_adapter_not_implemented`,
    };
  }
}
