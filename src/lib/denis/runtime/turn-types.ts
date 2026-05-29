import { z } from "zod";
import { aiChatRequestSchema } from "@/lib/ai/chat-request.schema";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type {
  DenisCartDraft,
  DenisCartState,
} from "@/lib/denis/kernel/cart-projection";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import { manualCartSnapshotSchema } from "@/lib/denis/platform/sense-types";
import type { ManualCartSnapshot } from "@/lib/denis/runtime/adapters/map-legacy-draft";
import type { TablePartyModel } from "@/lib/denis/venue/party/types";
import type {
  OpsPlannerEffects,
  VenueOpsBeliefs,
} from "@/lib/denis/venue/ops/types";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type { FoldMeta, TableSessionState } from "@/lib/denis/loop/types";
import type { NarrationTier } from "@/lib/denis/runtime/narrate/narration-facts.schema";

export type DenisChannel = "chat" | "voice" | "proactive" | "status_poll";

export { manualCartSnapshotSchema };

const guestIntentSchema = z.enum([
  "ORDER",
  "CLARIFY_REPLY",
  "CONFIRM",
  "DECLINE",
  "DONE",
  "BROWSE",
  "STATUS",
  "HANDOFF_WAITER",
  "HANDOFF_PAY",
  "ORDER_CANCEL",
  "ORDER_MODIFY",
  "SMALLTALK",
  "UNKNOWN",
]);

const handoffPaymentMethodSchema = z.enum([
  "online",
  "at_bar",
  "card_at_table",
]);

export const denisChatBodySchema = aiChatRequestSchema.extend({
  manualCartSnapshot: manualCartSnapshotSchema.optional(),
  /** Active table session token (distinct from QR `sessionToken`). */
  tableSessionToken: z.string().trim().min(1).max(128).optional(),
  deviceFingerprint: z.string().trim().min(8).max(128).optional(),
  deviceToken: z.string().trim().min(1).max(128).optional(),
  /** Guest input surface — voice uses same body as chat with STT transcript (M18). */
  inputSurface: z.enum(["chat", "voice"]).optional(),
  /** M28 — structured chip / UI command (bypasses free-text LLM routing). */
  structuredIntent: guestIntentSchema.optional(),
  handoffPaymentMethod: handoffPaymentMethodSchema.optional(),
});

export type DenisChatBody = z.infer<typeof denisChatBodySchema>;

export type DenisTurnRunInput = {
  channel: DenisChannel;
  rawBody: unknown;
};

export type DenisTurnContext = {
  locationId: string;
  aiSessionId?: string;
  draftAiSessionId?: string;
  config: ConciergeConfig;
  flowNodeId: FlowNodeId;
  aiCartState: DenisCartState;
  manualCartDraft?: DenisCartDraft;
  peerManualCartDraft?: DenisCartDraft;
  party?: TablePartyModel | null;
  venueOps?: VenueOpsBeliefs;
  opsEffects?: OpsPlannerEffects;
  foodUpsellAsked: boolean;
  guestMemory?: GuestMemoryProjection | null;
  lastAssistantMessage?: string | null;
  /** ADR-019 Phase A — FOLD metadata for timeline + idempotency. */
  foldMeta?: FoldMeta;
  tableSessionState?: TableSessionState;
};

export type DenisTurnMeta = {
  traceId: string;
  conflictPrompt: string | null;
  flowNodeId: FlowNodeId;
  topGoal: string | null;
  channel: DenisChannel;
  narrationTier?: NarrationTier;
  lintPassed?: boolean;
  usedNarrationFallback?: boolean;
  rolloutMode?: string;
  partyMode?: string;
  partyDeviceCount?: number;
  isPrimaryDevice?: boolean;
  sharedAiSessionId?: string | null;
  operatingMode?: string;
  kdsStress?: string;
  /** G2 — server-side ACL submit in turn; response includes orderSubmit when placed. */
  actSubmitLive?: boolean;
  actSubmitAttempted?: boolean;
  actOrderNumber?: number;
};

export type { ManualCartSnapshot };
