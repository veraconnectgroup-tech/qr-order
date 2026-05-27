import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";
import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import { executePlannedSkill } from "@/lib/denis/runtime/act/execute-skill";
import type { ActPhaseResult } from "@/lib/denis/runtime/act/act-types";

export type ActPhaseInput = {
  config: ConciergeConfig;
  reflexTurn: ReflexTurnResult;
  aiSessionId?: string;
  tableToken?: string;
  sessionToken?: string;
  deviceFingerprint?: string;
  deviceToken?: string;
  cartDraft?: DenisCartDraft;
  catalog?: AiCatalog;
  legacySubmitOrder?: boolean;
};

/** M23 — run planned skills; default dry-run (timeline only). */
export async function executeActPhase(
  input: ActPhaseInput
): Promise<ActPhaseResult> {
  if (!input.config.ordering.actLayerEnabled) {
    return { enabled: false, dryRun: true, results: [] };
  }

  const dryRun = input.config.ordering.actDryRun;
  const allowSubmit =
    input.config.ordering.actSubmitEnabled &&
    !dryRun &&
    Boolean(input.legacySubmitOrder);

  const results = [];

  for (const planned of input.reflexTurn.plan.skills) {
    const result = await executePlannedSkill({
      config: input.config,
      dryRun: dryRun || planned.id !== "order.submit",
      allowSubmit,
      skillId: planned.id,
      aiSessionId: input.aiSessionId,
      tableToken: input.tableToken,
      sessionToken: input.sessionToken,
      deviceFingerprint: input.deviceFingerprint,
      deviceToken: input.deviceToken,
      cartDraft: input.cartDraft,
      catalog: input.catalog,
    });
    results.push(result);
  }

  return {
    enabled: true,
    dryRun: dryRun && !allowSubmit,
    results,
  };
}
