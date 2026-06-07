import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { SessionPhase } from "@/lib/denis/loop/types";

export function assertMentalModelInvariants(
  model: GuestMentalModel,
  context: {
    phase: SessionPhase;
    billSettled: boolean;
    maxProductCartChurn: number;
    cartAbandonedCount?: number;
  },
  errors: string[],
  prefix = ""
): void {
  const label = prefix ? `${prefix}: ` : "";

  if (model.decline.hardClosed && model.receptiveness !== "closed") {
    errors.push(
      `${label}decline.hardClosed requires receptiveness=closed, got ${model.receptiveness}`
    );
  }

  if (model.receptiveness === "closed") {
    if (!model.decline.hardClosed) {
      errors.push(`${label}receptiveness=closed requires decline.hardClosed`);
    }
    if (model.nudgeBudget.remaining !== 0 || model.nudgeBudget.max !== 0) {
      errors.push(
        `${label}receptiveness=closed requires nudgeBudget zero, got remaining=${model.nudgeBudget.remaining} max=${model.nudgeBudget.max}`
      );
    }
  }

  if (model.intent === "paying" && !context.billSettled && context.phase !== "closed") {
    errors.push(
      `${label}intent=paying requires billSettled or phase=closed (phase=${context.phase})`
    );
  }

  if (
    model.pace === "indecisive" &&
    context.maxProductCartChurn < 4 &&
    (context.cartAbandonedCount ?? 0) < 2
  ) {
    errors.push(
      `${label}pace=indecisive requires cart churn >= 4 or cartAbandoned >= 2`
    );
  }
}
