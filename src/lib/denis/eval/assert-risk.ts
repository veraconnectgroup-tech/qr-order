import type { SkillDefinition } from "@/lib/denis/kernel/skill-registry";
import type { DenisRiskClass } from "@/lib/denis/platform/risk-levels";

export type RiskAssertResult = {
  ok: boolean;
  violations: string[];
};

/** Ensure R5 skills only appear when explicitly allowed (M10). */
export function assertRiskBoundaries(input: {
  skills: SkillDefinition[];
  allowR5?: boolean;
}): RiskAssertResult {
  const violations: string[] = [];

  for (const skill of input.skills) {
    if (skill.riskClass === "R5" && !input.allowR5) {
      violations.push(`R5 skill ${skill.id} without allowR5`);
    }
  }

  return { ok: violations.length === 0, violations };
}

export function maxRiskClass(
  skills: SkillDefinition[]
): DenisRiskClass | null {
  const order: DenisRiskClass[] = ["R0", "R1", "R2", "R3", "R4", "R5"];
  let max: DenisRiskClass | null = null;
  for (const skill of skills) {
    if (!max || order.indexOf(skill.riskClass) > order.indexOf(max)) {
      max = skill.riskClass;
    }
  }
  return max;
}
