import type { PosIntegrationContext } from "@/lib/outbox/types";

export type FiscalBehavior = "standalone" | "vorsystem";

export function resolveFiscalBehavior(
  posIntegration: PosIntegrationContext | null
): FiscalBehavior {
  if (posIntegration?.status === "connected") {
    return "vorsystem";
  }
  return "standalone";
}
