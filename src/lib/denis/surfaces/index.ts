export { formatChatTurnApiResponse } from "@/lib/denis/surfaces/chat/format-turn-response";
export type { LegacyChatSuccessData } from "@/lib/denis/surfaces/chat/format-turn-response";
export { parseDenisChatBody } from "@/lib/denis/surfaces/chat/parse-chat-request";

/** L4 Surfaces — chat formatters (M7). */
export const DENIS_SURFACES_LAYER = "surfaces" as const;
