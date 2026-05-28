export type { ActPhaseResult, ActSkillResult } from "@/lib/denis/runtime/act/act-types";
export { buildDenisOrderCommand } from "@/lib/denis/runtime/act/build-order-command";
export { executeActPhase, type ActPhaseInput } from "@/lib/denis/runtime/act/execute-act-phase";
export { executePlannedSkill, type ExecuteSkillContext } from "@/lib/denis/runtime/act/execute-skill";
export { handoffNarrationMessage } from "@/lib/denis/runtime/act/handoff-narration";
export {
  handoffActEnabled,
  resolveActHandoffOutcome,
  type ActHandoffOutcome,
} from "@/lib/denis/runtime/act/resolve-act-handoff-outcome";
export {
  isActSubmitLive,
  resolveActSubmitOutcome,
  type ActSubmitOutcome,
} from "@/lib/denis/runtime/act/resolve-act-submit-outcome";

/** Runtime act — skill execution via ACL (M23). */
export const DENIS_ACT_LAYER = "act" as const;
