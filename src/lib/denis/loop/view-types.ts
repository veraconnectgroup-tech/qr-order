import type { SceneLayer, SceneMarkState, SessionPhase } from "@/lib/scene/types";

export type TranscriptEntry = {
  id: string;
  role: "guest" | "denis" | "system";
  text: string;
  at: string;
};

export type OrderSummary = {
  id: string;
  orderNumber: number | null;
  status: string;
  paymentStatus: string;
  estimatedPrepMinutes: number | null;
  items: Array<{ productName: string; quantity: number }>;
};

export type CartView = {
  aiItemCount: number;
  manualItemCount: number;
  visibleItemCount: number;
  hasConflict: boolean;
  conflictPrompt: string | null;
  revision: number;
};

export type AvailableAction = {
  id: string;
  labelKey: string;
  kind: "chip" | "order" | "bill" | "menu";
  orderId?: string;
};

/** Optional TELL output — overrides headline when loop just committed narration. */
export type TellResult = {
  headline?: string;
  markState?: SceneMarkState;
} | null;

export type TableSessionView = {
  version: number;
  sessionId: string;
  phase: SessionPhase;
  chrome: {
    tableName: string;
    venueName: string;
    headline: string;
    markState: SceneMarkState;
    denisActive: boolean;
  };
  layers: SceneLayer[];
  transcript: TranscriptEntry[];
  cart: CartView;
  orders: OrderSummary[];
  actions: AvailableAction[];
};

export type ProjectViewInput = {
  sessionId: string;
  venueName: string;
};
