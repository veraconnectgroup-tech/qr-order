import { runDenisWorldSignal } from "@/lib/denis/runtime/run-denis-world-signal";
import type { CommerceDenisWorldPayload } from "@/lib/denis/ingress/world-types";

export async function handleCommerceDenisWorld(
  payload: Record<string, unknown>
): Promise<void> {
  await runDenisWorldSignal(payload);
}

export type { CommerceDenisWorldPayload };
