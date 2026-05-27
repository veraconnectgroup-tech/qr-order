import { z } from "zod";
import { aiChatRequestSchema } from "@/lib/ai/execute-chat-turn";
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

export type DenisChannel = "chat" | "proactive" | "status_poll";

export { manualCartSnapshotSchema };

export const denisChatBodySchema = aiChatRequestSchema.extend({
  manualCartSnapshot: manualCartSnapshotSchema.optional(),
  deviceFingerprint: z.string().trim().min(8).max(128).optional(),
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
};

export type DenisTurnMeta = {
  traceId: string;
  conflictPrompt: string | null;
  flowNodeId: FlowNodeId;
  topGoal: string | null;
  channel: DenisChannel;
  narrationTier?: "template" | "T3";
  lintPassed?: boolean;
  usedNarrationFallback?: boolean;
  rolloutMode?: string;
  partyMode?: string;
  partyDeviceCount?: number;
  isPrimaryDevice?: boolean;
  sharedAiSessionId?: string | null;
  operatingMode?: string;
  kdsStress?: string;
};

export type { ManualCartSnapshot };
