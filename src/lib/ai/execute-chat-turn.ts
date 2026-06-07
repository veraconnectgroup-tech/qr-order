export {
  aiChatRequestSchema,
  type AiChatRequest,
  type PerceiveGuestChatTurnOpts,
} from "@/lib/ai/chat-request.schema";

export {
  perceiveGuestChatTurn,
  perceiveGuestChatTurn as executeChatTurn,
} from "@/lib/denis/cognition/perceive";

/** @deprecated G4 — alias for PerceiveGuestChatTurnOpts. */
export type { PerceiveGuestChatTurnOpts as ExecuteChatTurnOpts } from "@/lib/ai/chat-request.schema";
