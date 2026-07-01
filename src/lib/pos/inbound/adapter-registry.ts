import { DeliverectInboundAdapter } from "@/lib/pos/inbound/adapters/deliverect-inbound";
import { GenericInboundAdapter } from "@/lib/pos/inbound/adapters/generic-inbound";
import type { PosInboundAdapter } from "@/lib/pos/inbound/types";

const genericAdapter = new GenericInboundAdapter();
const deliverectAdapter = new DeliverectInboundAdapter();

const adapters: Record<string, PosInboundAdapter> = {
  deliverect: deliverectAdapter,
  orderbird: genericAdapter,
  lightspeed: genericAdapter,
  sumup: genericAdapter,
  ready2order: genericAdapter,
  custom: genericAdapter,
};

export function getPosInboundAdapter(provider: string): PosInboundAdapter {
  return adapters[provider] ?? genericAdapter;
}
