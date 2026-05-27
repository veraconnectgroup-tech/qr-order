"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateOrgPlanAction } from "@/lib/platform/platform-actions";
import type { PlanRow } from "@/lib/billing/plans";

export function PlatformPlanSelector({
  orgId,
  currentPlanId,
  plans,
}: {
  orgId: string;
  currentPlanId: string | null;
  plans: PlanRow[];
}) {
  const [pending, startTransition] = useTransition();

  function onChange(planId: string) {
    startTransition(async () => {
      const result = await updateOrgPlanAction(orgId, planId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Plan updated");
    });
  }

  return (
    <select
      value={currentPlanId ?? "starter"}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      className="mt-2 h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
    >
      {plans.map((plan) => (
        <option key={plan.id} value={plan.id}>
          {plan.name}
        </option>
      ))}
    </select>
  );
}
