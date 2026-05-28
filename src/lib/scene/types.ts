/** ADR-016 SC-1 — versioned guest/staff UI contract (read-only projection). */

export type SessionPhase =
  | "latent"
  | "browsing"
  | "ordering"
  | "waiting"
  | "settling"
  | "closed";

export type SceneMarkState = "idle" | "listen" | "think";

export type SceneBlockingReason = "consent" | "payment" | "conflict";

export type SceneBannerAction =
  | "open_sheet"
  | "add_product"
  | "dismiss"
  | "feedback"
  | "view_order"
  | "view_bill";

export type SceneSituationAction =
  | { kind: "open_order"; orderId: string }
  | { kind: "open_bill"; scope: "order" | "session"; orderId?: string }
  | { kind: "open_menu" };

export type SceneLayer =
  | { kind: "ambient" }
  | {
      kind: "blocking";
      reason: SceneBlockingReason;
      message: string;
    }
  | {
      kind: "sheet";
      open: boolean;
      title: string;
      thinking: boolean;
    }
  | {
      kind: "banner";
      id: string;
      message: string;
      action?: SceneBannerAction;
      productId?: string;
      productName?: string;
      orderId?: string;
    }
  | {
      kind: "inline";
      productId: string;
      name: string;
      reason?: string;
      priceCents?: number;
    }
  | {
      kind: "chips";
      options: Array<{ id: string; label: string; selected?: boolean }>;
    };

export type SceneSituationOrder = {
  orderId: string;
  orderNumber: number;
  status: string;
  itemsLabel: string;
  prepMinutes: number | null;
  paymentStatus: string;
  primaryAction: SceneSituationAction;
};

export type SceneSituation = {
  headline: string;
  orders: SceneSituationOrder[];
  hasReadyOrder: boolean;
  hasActiveKitchen: boolean;
};

export type SceneChrome = {
  tableName: string;
  venueName: string;
  markState: SceneMarkState;
  denisActive: boolean;
  situation: SceneSituation | null;
};

export type Scene = {
  version: number;
  sessionId: string;
  phase: SessionPhase;
  chrome: SceneChrome;
  layers: SceneLayer[];
};

/** Pure inputs for composeScene — loaded from DB projections + optional runtime overrides. */
export type ComposeSceneInput = {
  sessionId: string;
  tableName: string;
  venueName: string;
  phase: SessionPhase;
  markState: SceneMarkState;
  denisActive: boolean;
  sheetOpen: boolean;
  sheetTitle: string;
  thinking: boolean;
  blocking: {
    reason: SceneBlockingReason;
    message: string;
  } | null;
  banners: Array<{
    id: string;
    message: string;
    action?: SceneBannerAction;
    productId?: string;
    productName?: string;
    orderId?: string;
  }>;
  inlineRecommendations: Array<{
    productId: string;
    name: string;
    reason?: string;
    priceCents?: number;
  }>;
  chips: Array<{ id: string; label: string; selected?: boolean }>;
  situation: SceneSituation | null;
};

export type StaffTileView = {
  sessionId: string;
  tableName: string;
  phase: SessionPhase;
  denisActive: boolean;
  markState: SceneMarkState;
  alertMessage: string | null;
};

export type StaffDetailView = StaffTileView & {
  venueName: string;
  layers: SceneLayer[];
  version: number;
};
