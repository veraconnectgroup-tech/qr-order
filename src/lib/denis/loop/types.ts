import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type {
  DenisCartDraft,
  DenisCartLine,
  DenisCartState,
} from "@/lib/denis/kernel/cart-projection";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type { ManualCartSnapshotInput } from "@/lib/denis/platform/sense-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { TablePartyModel } from "@/lib/denis/venue/party/types";
import type {
  OpsPlannerEffects,
  VenueOpsBeliefs,
} from "@/lib/denis/venue/ops/types";

import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestOfferContext } from "@/lib/denis/cognition/offer/offer-types";
import type { ConversationModel } from "@/lib/denis/cognition/conversation/conversation-types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { WaiterObligation } from "@/lib/denis/cognition/waiter/waiter-obligation-types";
import type { PendingSlotKind } from "@/lib/denis/platform/pending-slot-types";
import type { SessionPhase } from "@/lib/scene/types";

export type { SessionPhase };

export type OrderFact = {
  id: string;
  orderNumber: number | null;
  status: string;
  paymentStatus: string;
  estimatedPrepMinutes: number | null;
  createdAt: string;
  items: Array<{
    orderItemId?: string;
    productId?: string | null;
    productName: string;
    quantity: number;
    lineTotalCents?: number;
  }>;
};

export type MergedCart = {
  ai: DenisCartState;
  manual?: DenisCartDraft;
  peerManual?: DenisCartDraft;
  /** Union of AI + manual lines for planner visibility. */
  visibleLines: DenisCartLine[];
};

export type TableSessionState = {
  table: {
    id: string;
    name: string;
    token: string;
  };
  session: {
    id: string;
    status: string;
    accessState: string | null;
    billSettled: boolean;
    feedbackSubmitted: boolean;
    denisEnabled: boolean;
    denisActive: boolean;
  };
  commerce: {
    orders: OrderFact[];
    cart: MergedCart;
  };
  venue: {
    ops: VenueOpsBeliefs;
    opsEffects: OpsPlannerEffects;
  };
  party?: TablePartyModel | null;
  guest?: GuestMemoryProjection | null;
  conversation: {
    flowNodeId: FlowNodeId;
    foodUpsellAsked: boolean;
    dismissedNudges: string[];
    lastAssistantMessage: string | null;
    /** From ai_sessions.order_draft.pending — size/modifier awaiting guest reply. */
    pendingSlot: PendingSlotKind | null;
    /** C6 — folded dialogue state (transcript, awaiting, summary). */
    model: ConversationModel;
    /** ADR-032 — what Denis must clarify before confirm (persists across turns). */
    obligation: WaiterObligation | null;
  };
  timeline: DenisTimelineRow[];
  /** F1 browse telemetry — folded from timeline browse events. */
  browse: GuestBrowseProfile;
  /** ADR-038 — guest psychology profile rebuilt every FOLD. */
  mental: GuestMentalModel;
  /** ADR-038 GMM-9 — resolved offer snapshot (pure fold). */
  offer: GuestOfferContext;
  config: ConciergeConfig;
};

export type FoldInput = {
  locationId: string;
  tableId: string;
  sessionToken: string;
  aiSessionId?: string;
  draftAiSessionId?: string;
  deviceFingerprint?: string;
  manualCartSnapshot?: ManualCartSnapshotInput;
  config?: ConciergeConfig;
  tableSessionId?: string | null;
  party?: TablePartyModel | null;
};

export type FoldMeta = {
  truthHash: string;
  orderCount: number;
  phase: SessionPhase;
  tableSessionId: string | null;
  draftAiSessionId: string | null;
};

export type FoldResult = {
  state: TableSessionState;
  meta: FoldMeta;
};
