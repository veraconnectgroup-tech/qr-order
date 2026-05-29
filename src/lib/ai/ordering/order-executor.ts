import type { AiOrderDraft } from "@/lib/ai/ordering/draft-types";

/** Empty AI session draft after successful ACL submit (G2). */
export function clearedDraftAfterSubmit(): AiOrderDraft {
  return {
    version: 1,
    items: [],
    pending: null,
    cartRevision: 0,
    updatedAt: new Date().toISOString(),
  };
}
