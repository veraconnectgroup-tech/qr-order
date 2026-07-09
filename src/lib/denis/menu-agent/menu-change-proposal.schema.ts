import { z } from "zod";
import { zOptionalSanitizedText, zSanitizedText, zUuid } from "@/lib/security/zod-fields";

/**
 * "LLM proposes, policy executes" for menu edits — same safety pattern as
 * src/lib/denis/acl/ for orders. The chat endpoint only ever produces one
 * of these (never writes to products/categories itself); the apply
 * endpoint is the sole path that turns a confirmed proposal into a real
 * write, after the owner clicks Primeni.
 */

export const AddProductProposalSchema = z.object({
  type: z.literal("add_product"),
  name: zSanitizedText(200).pipe(z.string().min(1)),
  description: zOptionalSanitizedText(2000),
  price: z.number().positive().max(1_000_000),
  categoryId: zUuid().nullable(),
});

export const UpdatePriceProposalSchema = z.object({
  type: z.literal("update_price"),
  productId: zUuid(),
  newPrice: z.number().positive().max(1_000_000),
});

export const UpdateDescriptionProposalSchema = z.object({
  type: z.literal("update_description"),
  productId: zUuid(),
  newDescription: zSanitizedText(2000).pipe(z.string().min(1)),
});

export const MenuChangeProposalSchema = z.discriminatedUnion("type", [
  AddProductProposalSchema,
  UpdatePriceProposalSchema,
  UpdateDescriptionProposalSchema,
]);

export type MenuChangeProposal = z.infer<typeof MenuChangeProposalSchema>;
