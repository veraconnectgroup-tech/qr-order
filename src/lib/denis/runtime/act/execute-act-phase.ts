import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";
import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import { executePlannedSkill } from "@/lib/denis/runtime/act/execute-skill";
import type { ActPhaseResult } from "@/lib/denis/runtime/act/act-types";
import { handoffActEnabled } from "@/lib/denis/runtime/act/resolve-act-handoff-outcome";
import { orderChangeActEnabled } from "@/lib/denis/runtime/act/resolve-act-order-change-outcome";
import { resolveSkill } from "@/lib/denis/kernel/skill-registry";
import type { PlannedSkill } from "@/lib/denis/kernel/plan-turn";

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

function plannedOrderChangeSkills(reflexTurn: ReflexTurnResult): boolean {
  return reflexTurn.plan.skills.some(
    (skill) =>
      skill.id === "order.cancel" || skill.id === "order.modify.request"
  );
}

function plannedHandoffSkills(reflexTurn: ReflexTurnResult): boolean {
  return reflexTurn.plan.skills.some((skill) =>
    skill.id.startsWith("handoff.")
  );
}

/** LLM comprehend confirm may set submitOrder without flow CONFIRM → inject order.submit. */
function resolveActSkills(
  reflexTurn: ReflexTurnResult,
  allowSubmit: boolean
): PlannedSkill[] {
  const skills = [...reflexTurn.plan.skills];
  if (allowSubmit && !skills.some((skill) => skill.id === "order.submit")) {
    const submitSkill = resolveSkill("order.submit");
    if (submitSkill) skills.push(submitSkill);
  }
  return skills;
}

/** M23 + M28 — run planned skills; handoffs live by default. */
export async function executeActPhase(
  input: ActPhaseInput
): Promise<ActPhaseResult> {
  const liveHandoff = handoffActEnabled(input.config);
  const liveOrderChange = orderChangeActEnabled(input.config);
  const hasHandoff = plannedHandoffSkills(input.reflexTurn);
  const hasOrderChange = plannedOrderChangeSkills(input.reflexTurn);
  const orderActEnabled = input.config.ordering.actLayerEnabled;

  if (
    !orderActEnabled &&
    !(liveHandoff && hasHandoff) &&
    !(liveOrderChange && hasOrderChange)
  ) {
    return { enabled: false, dryRun: true, results: [] };
  }

  const dryRun = input.config.ordering.actDryRun;
  const confirmSubmit =
    input.reflexTurn.reflex?.intent === "CONFIRM" ||
    input.reflexTurn.plan.skills.some((skill) => skill.id === "order.submit");
  const allowSubmit =
    input.config.ordering.actSubmitEnabled &&
    !dryRun &&
    (Boolean(input.legacySubmitOrder) || confirmSubmit);

  const results = [];
  const skillsToRun = resolveActSkills(input.reflexTurn, allowSubmit);

  for (const planned of skillsToRun) {
    const isHandoff = planned.id.startsWith("handoff.");
    const isOrderChange =
      planned.id === "order.cancel" || planned.id === "order.modify.request";
    const skillDryRun = isHandoff
      ? !liveHandoff
      : isOrderChange
        ? !liveOrderChange
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
      !results.some((row) => row.skillId.startsWith("handoff.") && !row.dryRun) &&
      !results.some(
        (row) =>
          (row.skillId === "order.cancel" ||
            row.skillId === "order.modify.request") &&
          !row.dryRun
      ),
    results,
  };
}
