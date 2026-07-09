import type { OpenAiToolDefinition } from "@/lib/ai/types";

/**
 * Tool definitions for the menu-agent chat — deliberately NOT wired to any
 * executor. Calling one of these just means "the model wants to propose
 * this change"; the arguments become a MenuChangeProposal shown to the
 * owner as a card with Pregledaj/Primeni/Odbaci. Nothing here ever writes
 * to the database — see execute-menu-change-proposal.ts for the one path
 * that does, called only after the owner clicks Primeni.
 */

export const proposeAddProductTool: OpenAiToolDefinition = {
  name: "propose_add_product",
  description:
    "Propose adding a new menu item. Use real category IDs from the menu list you were given — never invent one.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Product name." },
      description: { type: "string", description: "Short guest-facing description." },
      price: { type: "number", description: "Price in the venue's currency, e.g. 320." },
      categoryId: {
        type: ["string", "null"],
        description: "A real category id from the menu list, or null if unsure.",
      },
    },
    required: ["name", "price"],
  },
};

export const proposeUpdatePriceTool: OpenAiToolDefinition = {
  name: "propose_update_price",
  description:
    "Propose changing an existing product's price. productId must be a real id from the menu list you were given.",
  parameters: {
    type: "object",
    properties: {
      productId: { type: "string" },
      newPrice: { type: "number" },
    },
    required: ["productId", "newPrice"],
  },
};

export const proposeUpdateDescriptionTool: OpenAiToolDefinition = {
  name: "propose_update_description",
  description:
    "Propose rewriting an existing product's description. productId must be a real id from the menu list you were given.",
  parameters: {
    type: "object",
    properties: {
      productId: { type: "string" },
      newDescription: { type: "string" },
    },
    required: ["productId", "newDescription"],
  },
};

export function listMenuAgentToolDefinitions(): OpenAiToolDefinition[] {
  return [
    proposeAddProductTool,
    proposeUpdatePriceTool,
    proposeUpdateDescriptionTool,
  ];
}

const TOOL_NAME_TO_PROPOSAL_TYPE: Record<string, string> = {
  propose_add_product: "add_product",
  propose_update_price: "update_price",
  propose_update_description: "update_description",
};

/** Maps a tool call's name + parsed arguments into a MenuChangeProposal-shaped object (unvalidated — the apply route re-validates with Zod). */
export function toolCallToProposalDraft(
  toolName: string,
  args: Record<string, unknown>
): Record<string, unknown> | null {
  const type = TOOL_NAME_TO_PROPOSAL_TYPE[toolName];
  if (!type) return null;
  return { type, ...args };
}
