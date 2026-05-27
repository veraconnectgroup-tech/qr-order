import { z } from "zod";
import type { DenisChannel } from "@/lib/denis/runtime/turn-types";

const denisInputSurfaceSchema = z.object({
  inputSurface: z.enum(["chat", "voice"]).optional(),
});

/** L4 — map guest request body to runtime channel (no business logic). */
export function inferDenisChannelFromBody(rawBody: unknown): DenisChannel {
  const parsed = denisInputSurfaceSchema.safeParse(rawBody);
  if (parsed.success && parsed.data.inputSurface === "voice") {
    return "voice";
  }
  return "chat";
}
