export {
  catalogToAllergyGuardProducts,
  checkAllergyConflict,
  isAllergyAcknowledged,
  isGuestAllergyRelatedMessage,
  mergeAllergieLabelSets,
  parseAllergenExclusionsFromText,
  resolveKnownAllergenIds,
  type AllergyGuardConflict,
  type AllergyGuardProduct,
  type AllergyGuardResult,
} from "@/lib/denis/kernel/safety/allergy-guard";
import type { AllergyGuardResult } from "@/lib/denis/kernel/safety/allergy-guard";
import type { WaiterGap } from "@/lib/denis/cognition/waiter/waiter-obligation-types";

export function buildAllergyWarningGap(
  guard: AllergyGuardResult
): WaiterGap | null {
  if (guard.safe || !guard.message) return null;
  return {
    kind: "allergy_warning",
    prompt: guard.message,
  };
}
