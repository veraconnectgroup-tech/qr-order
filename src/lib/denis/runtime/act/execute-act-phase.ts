import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";
import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import { executePlannedSkill } from "@/lib/denis/runtime/act/execute-skill";
import type { ActPhaseResult } from "@/lib/denis/runtime/act/act-types";
import { handoffActEnabled } from "@/lib/denis/runtime/act/resolve-act-handoff-outcome";

export type ActPhaseInput = {
  config: ConciergeConfig;
  reflexTurn: ReflexTurnResult;
  aiSessionId?: string;
  tableId?: string;
  locationId?: string;
  tableToken?: string;
  sessionToken?: string;
  deviceFingerprint?: string;
  deviceToken?: string;
  cartDraft?: DenisCartDraft;
  catalog?: AiCatalog;
  legacySubmitOrder?: boolean;
};

function plannedHandoffSkills(reflexTurn: ReflexTurnResult): boolean {
  return reflexTurn.plan.skills.some((skill) =>
    skill.id.startsWith("handoff.")
  );
}

/** M23 + M28 — run planned skills; handoffs live by default. */
export async function executeActPhase(
  input: ActPhaseInput
): Promise<ActPhaseResult> {
  const liveHandoff = handoffActEnabled(input.config);
  const hasHandoff = plannedHandoffSkills(input.reflexTurn);
  const orderActEnabled = input.config.ordering.actLayerEnabled;

  if (!orderActEnabled && !(liveHandoff && hasHandoff)) {
    return { enabled: false, dryRun: true, results: [] };
  }

  const dryRun = input.config.ordering.actDryRun;
  const allowSubmit =
    input.config.ordering.actSubmitEnabled &&
    !dryRun &&
    Boolean(input.legacySubmitOrder);

  const results = [];

  for (const planned of input.reflexTurn.plan.skills) {
    const isHandoff = planned.id.startsWith("handoff.");
    const skillDryRun = isHandoff
      ? !liveHandoff
      : dryRun || planned.id !== "order.submit";

    const result = await executePlannedSkill({
      config: input.config,
      dryRun: skillDryRun,
      allowSubmit,
      liveHandoff,
      skillId: planned.id,
      aiSessionId: input.aiSessionId,
      tableId: input.tableId,
      locationId: input.locationId,
      tableToken: input.tableToken,
      sessionToken: input.sessionToken,
      deviceFingerprint: input.deviceFingerprint,
      deviceToken: input.deviceToken,
      cartDraft: input.cartDraft,
      catalog: input.catalog,
      handoffPaymentMethod: input.reflexTurn.handoffPaymentMethod,
    });
    results.push(result);
  }

  return {
    enabled: true,
    dryRun:
      !allowSubmit &&
      dryRun &&
      !results.some((row) => row.skillId.startsWith("handoff.") && !row.dryRun),
    results,
  };
}
