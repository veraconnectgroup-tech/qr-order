import { apiError } from "@/lib/api-response";
import { denisChatBodySchema } from "@/lib/denis/runtime/turn-types";

export function parseDenisChatBody(rawBody: unknown) {
  const parsed = denisChatBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      ok: false as const,
      response: apiError("Invalid input.", 400),
    };
  }
  return { ok: true as const, data: parsed.data };
}
