import type { PosAdapter } from "@/lib/pos/types";
import { DeliverectAdapter } from "@/lib/pos/adapters/deliverect";

const adapters: Record<string, PosAdapter> = {
  deliverect: new DeliverectAdapter(),
};

export function getPosAdapter(provider: string): PosAdapter | undefined {
  return adapters[provider];
}
