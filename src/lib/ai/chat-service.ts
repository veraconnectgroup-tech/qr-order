import { runDenisTurn } from "@/lib/denis/runtime/run-denis-turn";

export {
  aiChatRequestSchema,
  type AiChatRequest,
} from "@/lib/ai/execute-chat-turn";

/** Thin wrapper — Denis PPAN+ owns orchestration (M7). */
export async function handleAiChat(body: unknown): Promise<Response> {
  return runDenisTurn({ channel: "chat", rawBody: body });
}
