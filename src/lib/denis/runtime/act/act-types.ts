import type { DenisSkillId } from "@/lib/denis/kernel/skill-registry";
import type { DenisRiskClass } from "@/lib/denis/platform/risk-levels";

export type ActSkillResult = {
  skillId: DenisSkillId;
  riskClass: DenisRiskClass;
  dryRun: boolean;
  ok: boolean;
  error?: string;
  detail?: Record<string, unknown>;
};

export type ActPhaseResult = {
  enabled: boolean;
  dryRun: boolean;
  results: ActSkillResult[];
};
