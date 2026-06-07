import { z } from "zod";
import { AI_CONFIG } from "@/lib/ai/config";
import type { AiGuestPreferences } from "@/lib/ai/types";
import { sanitizeText } from "@/lib/security/sanitize";
import {
  zSanitizedText,
  zSessionToken,
  zUuid,
} from "@/lib/security/zod-fields";

const preferencesSchema = z
  .object({
    allergies: z
      .array(z.string().trim().max(100))
      .max(20)
      .optional()
      .transform((items) =>
        items?.map((item) => sanitizeText(item, 100)).filter(Boolean)
      ),
    mood: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((value) => (value ? sanitizeText(value, 200) : "")),
  })
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    const allergies = value.allergies ?? [];
    const mood = value.mood ?? "";
    if (!allergies.length && !mood) return undefined;
    return { allergies, mood } satisfies AiGuestPreferences;
  });

export const aiChatRequestSchema = z.object({
  locationId: zUuid(),
  tableId: zUuid(),
  sessionToken: zSessionToken(),
  message: zSanitizedText(AI_CONFIG.input.maxLength),
  language: z.string().trim().min(2).max(10),
  sessionId: zUuid().optional(),
  preferences: preferencesSchema,
  includeOrderContext: z.boolean().optional().default(true),
  browsingContext: zSanitizedText(2000).optional(),
  allowOrdering: z.boolean().optional().default(true),
});

export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;

/** Phase F — transcript TRUTH is timeline-only; legacy persistMessages removed. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intersected by DenisPerceiveTurnOpts
export type PerceiveGuestChatTurnOpts = {};
