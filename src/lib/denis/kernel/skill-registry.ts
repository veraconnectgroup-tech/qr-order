import type { DenisRiskClass } from "@/lib/denis/platform/risk-levels";

export type DenisSkillId =
  | "cart.add_or_clarify"
  | "cart.recap"
  | "cart.remove"
  | "cart.replace"
  | "order.submit"
  | "browse.search"
  | "status.table"
  | "upsell.ask_food_once"
  | "handoff.waiter"
  | "handoff.payment";

export type SkillDefinition = {
  id: DenisSkillId;
  riskClass: DenisRiskClass;
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
};

export function resolveSkill(skillId: string): SkillDefinition | null {
  return SKILL_REGISTRY[skillId as DenisSkillId] ?? null;
}

export function skillsForNode(skillIds: string[]): SkillDefinition[] {
  return skillIds
    .map((id) => resolveSkill(id))
    .filter((skill): skill is SkillDefinition => skill !== null);
}
