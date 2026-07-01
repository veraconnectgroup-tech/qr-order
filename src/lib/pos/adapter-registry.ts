import { DeliverectAdapter } from "@/lib/pos/adapters/deliverect";
import { LightspeedAdapter } from "@/lib/pos/adapters/lightspeed";
import { OrderbirdAdapter } from "@/lib/pos/adapters/orderbird";
import { SumUpAdapter } from "@/lib/pos/adapters/sumup";
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
