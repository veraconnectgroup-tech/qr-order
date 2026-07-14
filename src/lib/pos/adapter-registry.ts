import { DeliverectAdapter } from "@/lib/pos/adapters/deliverect";
import { LightspeedAdapter } from "@/lib/pos/adapters/lightspeed";
import { OrderbirdAdapter } from "@/lib/pos/adapters/orderbird";
import { SumUpAdapter } from "@/lib/pos/adapters/sumup";
import { SkeletonPosAdapter } from "@/lib/pos/adapters/skeleton-adapter";
import type { PosAdapter } from "@/lib/pos/types";

const adapters: Record<string, PosAdapter> = {
  deliverect: new DeliverectAdapter(),
  lightspeed: new LightspeedAdapter(),
  orderbird: new OrderbirdAdapter(),
  sumup: new SumUpAdapter(),
};

export const POS_OUTBOUND_ADAPTERS = Object.keys(adapters);

export function getPosAdapter(provider: string): PosAdapter | undefined {
  return adapters[provider];
}

export function listPosAdapters(): PosAdapter[] {
  return Object.values(adapters);
}

/**
 * True only when a provider has a real (non-skeleton) adapter — the same
 * "not_built" check registry.ts's resolvePosState already applies to
 * decide what Denis's own honesty layer reports, now the single source
 * of truth shared with the connect-integration server action too (was
 * previously only enforced on the read side, never on the write side —
 * an admin could "connect" a provider with zero working adapter and the
 * form would happily mark it status:"connected").
 */
export function isPosAdapterBuilt(provider: string): boolean {
  const adapter = adapters[provider];
  return Boolean(adapter) && !(adapter instanceof SkeletonPosAdapter);
}
