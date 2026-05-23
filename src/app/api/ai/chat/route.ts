import { NextRequest } from "next/server";
import { handleAiChat } from "@/lib/ai/chat-service";
import { zSessionToken } from "@/lib/security/zod-fields";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withRateLimitByKey } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Invalid input.", 400);
    }

    const sessionTokenParsed = zSessionToken().safeParse(
      (body as { sessionToken?: string }).sessionToken ?? ""
    );
    if (!sessionTokenParsed.success) {
      return apiError("Invalid input.", 400);
    }

    const limited = await withRateLimitByKey(
      "ai",
      sessionTokenParsed.data
    );
    if (limited) return limited;

    return await handleAiChat(body);
  } catch (error) {
    logger.error("AI chat route error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("Internal error.", 500);
  }
}
