import type { PerceiveGuestChatTurnOpts } from "@/lib/ai/chat-request.schema";
import type { TurnEvidencePack } from "@/lib/denis/cognition/context/plan-evidence";
import type { DenisPerceiveMode } from "@/lib/denis/cognition/runtime-profile-types";
import type { TurnPlan } from "@/lib/denis/cognition/tde/turn-plan-types";

/** MR-3 perceive options — TDE + evidence (extends legacy chat opts). */
export type DenisPerceiveTurnOpts = PerceiveGuestChatTurnOpts & {
  turnPlan?: TurnPlan;
  skipLlm?: boolean;
  templateMessage?: string | null;
  perceiveMode?: DenisPerceiveMode;
  model?: string;
  evidence?: TurnEvidencePack;
  templateIntent?: "chat" | "clarify" | "confirm" | "menu_info";
  leadershipContext?: import("@/lib/ai/conversation-leadership").ConversationLeadershipContext;
};
