import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

/** Composable perceive pipeline skills — distinct from ACT skills in SKILL_REGISTRY. */
export type PipelineSkillPhase = "pre" | "post";

export type PipelineSkillId =
  | "pre.allergy_guard"
  | "pre.cart_state"
  | "pre.menu_filter"
  | "post.order_validator"
  | "post.price_check"
  | "post.tone_guard"
  | "post.safety_guard";

export type PipelineSkillDefinition = {
  id: PipelineSkillId;
  phase: PipelineSkillPhase;
  description: string;
};

export const PIPELINE_SKILL_REGISTRY: Record<
  PipelineSkillId,
  PipelineSkillDefinition
> = {
  "pre.allergy_guard": {
    id: "pre.allergy_guard",
    phase: "pre",
    description: "Inject guest allergy context into LLM prompt",
  },
  "pre.cart_state": {
    id: "pre.cart_state",
    phase: "pre",
    description: "Inject current cart draft into LLM prompt",
  },
  "pre.menu_filter": {
    id: "pre.menu_filter",
    phase: "pre",
    description: "Remove unavailable items from menu context",
  },
  "post.order_validator": {
    id: "post.order_validator",
    phase: "post",
    description: "Verify LLM extracted valid catalog items",
  },
  "post.price_check": {
    id: "post.price_check",
    phase: "post",
    description: "Correct wrong prices mentioned in guest-facing copy",
  },
  "post.tone_guard": {
    id: "post.tone_guard",
    phase: "post",
    description: "Strip forbidden phrases and fix refusal tone",
  },
  "post.safety_guard": {
    id: "post.safety_guard",
    phase: "post",
    description: "Block harmful or policy-violating output",
  },
};

export const DEFAULT_PRE_PIPELINE_SKILLS: PipelineSkillId[] = [
  "pre.allergy_guard",
  "pre.cart_state",
  "pre.menu_filter",
];

export const DEFAULT_POST_PIPELINE_SKILLS: PipelineSkillId[] = [
  "post.order_validator",
  "post.price_check",
  "post.tone_guard",
  "post.safety_guard",
];

export function resolvePipelineSkill(
  skillId: string
): PipelineSkillDefinition | null {
  return PIPELINE_SKILL_REGISTRY[skillId as PipelineSkillId] ?? null;
}

export function resolveActivePipelineSkills(
  config: ConciergeConfig
): { pre: PipelineSkillId[]; post: PipelineSkillId[] } {
  const pipeline = config.pipeline;
  if (!pipeline?.enabled) {
    return { pre: [], post: [] };
  }
  const pre = (pipeline.preSkills ?? DEFAULT_PRE_PIPELINE_SKILLS).filter(
    (id): id is PipelineSkillId => resolvePipelineSkill(id)?.phase === "pre"
  );
  const post = (pipeline.postSkills ?? DEFAULT_POST_PIPELINE_SKILLS).filter(
    (id): id is PipelineSkillId => resolvePipelineSkill(id)?.phase === "post"
  );
  return { pre, post };
}

/** ACT skills (cart.submit, handoff, …) — unchanged registry surface. */
export type DenisSkillId =
  | "cart.add_or_clarify"
  | "cart.recap"
  | "cart.remove"
  | "cart.replace"
  | "order.submit"
  | "order.cancel"
  | "order.modify.request"
  | "browse.search"
  | "status.table"
  | "upsell.ask_food_once"
  | "handoff.waiter"
  | "handoff.payment"
  | "preorder.schedule";

export type SkillDefinition = {
  id: DenisSkillId;
  riskClass: import("@/lib/denis/platform/risk-levels").DenisRiskClass;
  description: string;
};

export const SKILL_REGISTRY: Record<DenisSkillId, SkillDefinition> = {
  "cart.add_or_clarify": {
    id: "cart.add_or_clarify",
    riskClass: "R2",
    description: "Add or clarify cart lines",
  },
  "cart.recap": {
    id: "cart.recap",
    riskClass: "R4",
    description: "Show order recap before confirm",
  },
  "cart.remove": {
    id: "cart.remove",
    riskClass: "R2",
    description: "Remove cart line",
  },
  "cart.replace": {
    id: "cart.replace",
    riskClass: "R2",
    description: "Replace cart line",
  },
  "order.submit": {
    id: "order.submit",
    riskClass: "R5",
    description: "Submit order via Order Core ACL",
  },
  "order.cancel": {
    id: "order.cancel",
    riskClass: "R4",
    description: "Guest cancel pending order or escalate to staff",
  },
  "order.modify.request": {
    id: "order.modify.request",
    riskClass: "R4",
    description: "Guest modify request — cancel pending or staff handoff",
  },
  "browse.search": {
    id: "browse.search",
    riskClass: "R1",
    description: "Browse menu recommendations",
  },
  "status.table": {
    id: "status.table",
    riskClass: "R0",
    description: "Read order status snapshot",
  },
  "upsell.ask_food_once": {
    id: "upsell.ask_food_once",
    riskClass: "R1",
    description: "Ask food upsell once after drinks",
  },
  "handoff.waiter": {
    id: "handoff.waiter",
    riskClass: "R3",
    description: "Trigger waiter call handoff",
  },
  "handoff.payment": {
    id: "handoff.payment",
    riskClass: "R1",
    description: "Payment / checkout hint",
  },
  "preorder.schedule": {
    id: "preorder.schedule",
    riskClass: "R4",
    description: "Schedule guest preorder for future arrival",
  },
};

export function resolveSkill(skillId: string): SkillDefinition | null {
  return SKILL_REGISTRY[skillId as DenisSkillId] ?? null;
}

export function skillsForNode(skillIds: string[]): SkillDefinition[] {
  return skillIds
    .map((id) => resolveSkill(id))
    .filter((skill): skill is SkillDefinition => skill !== null);
}
