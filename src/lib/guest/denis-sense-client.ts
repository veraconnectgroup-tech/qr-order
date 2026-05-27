import type { GuestManualCartSnapshot } from "@/lib/guest/manual-cart-snapshot";

export type DenisSenseProactiveNudge = {
  kind: "browse_nudge" | "drink_pairing" | "dessert_nudge" | "slow_kitchen";
  message: string;
  orderId?: string;
  prompt?: string;
};

export type DenisSenseResponse = {
  traceId: string;
  aiSessionId: string | null;
  schedulesUpserted: number;
  conflictPrompt: string | null;
  ingested: boolean;
  proactiveNudge?: DenisSenseProactiveNudge | null;
  quickReplies?: string[];
};

export type PostDenisSenseInput = {
  locationId: string;
  tableId: string;
  sessionToken: string;
  aiSessionId?: string;
  channel:
    | "telemetry.manual_cart"
    | "telemetry.scroll"
    | "realtime.order_status"
    | "ui.conversion"
    | "system.proactive_tick";
  payload?: Record<string, unknown>;
  manualCartSnapshot?: GuestManualCartSnapshot;
};

export async function postDenisSense(
  input: PostDenisSenseInput
): Promise<DenisSenseResponse | null> {
  try {
    const res = await fetch("/api/denis/sense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await res.json()) as {
      data?: DenisSenseResponse;
    };
    if (!res.ok || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}
