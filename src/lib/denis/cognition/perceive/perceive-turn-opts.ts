import type { PerceiveGuestChatTurnOpts } from "@/lib/ai/chat-request.schema";
import type { TurnEvidencePack } from "@/lib/denis/cognition/context/plan-evidence";
import type { DenisPerceiveMode } from "@/lib/denis/cognition/runtime-profile-types";
import type { InterpretationTask } from "@/lib/denis/cognition/tde/interpretation-task-types";
import type { TurnPlan } from "@/lib/denis/cognition/tde/turn-plan-types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestLevelId } from "@/lib/denis/commerce/loyalty/guest-level";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

/** MR-3 perceive options — TDE + evidence (extends legacy chat opts). */
export type DenisPerceiveTurnOpts = PerceiveGuestChatTurnOpts & {
  turnPlan?: TurnPlan;
  interpretationTask?: InterpretationTask | null;
  skipLlm?: boolean;
  templateMessage?: string | null;
  perceiveMode?: DenisPerceiveMode;
  model?: string;
  modelTier?: import("@/lib/denis/cognition/runtime-profile-types").DenisModelTier;
  extendedThinking?: boolean;
  complexityScore?: number;
  guestMentalModel?: GuestMentalModel | null;
  guestMemory?: GuestMemoryProjection | null;
  guestLevel?: GuestLevelId | null;
  pipeline?: {
    allergyLabels?: string[];
    allergyGuardMessage?: string | null;
    unavailableProductIds?: string[];
    reflexIntent?: string | null;
  };
  evidence?: TurnEvidencePack;
  templateIntent?: "chat" | "clarify" | "confirm" | "menu_info";
  leadershipContext?: import("@/lib/ai/conversation-leadership").ConversationLeadershipContext;
  /**
   * Opt-in — when set, the guest-facing `message` text is revealed
   * token-by-token as the LLM generates it. Everything else (cart actions,
   * quick replies, guards) is unaffected and still resolves from the full
   * parsed response once the stream completes.
   */
  onMessageDelta?: (text: string) => void;
};
