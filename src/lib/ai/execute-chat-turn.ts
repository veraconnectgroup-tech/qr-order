export {
  aiChatRequestSchema,
  type AiChatRequest,
  type PerceiveGuestChatTurnOpts,
} from "@/lib/ai/chat-request.schema";

export {
  perceiveGuestChatTurn,
} from "@/lib/denis/runtime/perceive/perceive-guest-chat-turn";

/** @deprecated G4 — use perceiveGuestChatTurn via runDenisTurn. */
export { perceiveGuestChatTurn as executeChatTurn } from "@/lib/denis/runtime/perceive/perceive-guest-chat-turn";

/** @deprecated G4 — alias for PerceiveGuestChatTurnOpts. */
export type { PerceiveGuestChatTurnOpts as ExecuteChatTurnOpts } from "@/lib/ai/chat-request.schema";
