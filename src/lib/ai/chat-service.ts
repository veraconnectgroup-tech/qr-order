import { inferDenisChannelFromBody } from "@/lib/denis/surfaces/voice/infer-denis-channel";
import { runDenisTurn } from "@/lib/denis/runtime/run-denis-turn";

export {
  aiChatRequestSchema,
  type AiChatRequest,
} from "@/lib/ai/execute-chat-turn";

/** Thin wrapper — Denis PPAN+ owns orchestration (M7, M18 voice). */
export async function handleAiChat(body: unknown): Promise<Response> {
  return runDenisTurn({
    channel: inferDenisChannelFromBody(body),
    rawBody: body,
  });
}
