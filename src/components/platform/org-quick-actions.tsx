"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  extendOrgTrialAction,
  setDenisEnabledAction,
} from "@/lib/platform/platform-actions";
import { Button } from "@/components/ui/button";

const TRIAL_EXTENSIONS = [7, 14, 30] as const;

export function OrgQuickActions({
  orgId,
  denisEnabled,
}: {
  orgId: string;
  denisEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function extendTrial(days: number) {
    startTransition(async () => {
      const result = await extendOrgTrialAction(orgId, days);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Trial extended by ${days} days`);
    });
  }

  function toggleDenis() {
    startTransition(async () => {
      const result = await setDenisEnabledAction(orgId, !denisEnabled);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(denisEnabled ? "Denis disabled" : "Denis enabled");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {TRIAL_EXTENSIONS.map((days) => (
        <Button
          key={days}
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => extendTrial(days)}
        >
          +{days}d trial
        </Button>
      ))}
      <Button
        type="button"
        variant={denisEnabled ? "destructive" : "default"}
        size="sm"
        disabled={pending}
        onClick={toggleDenis}
        className={denisEnabled ? undefined : "bg-violet-600 hover:bg-violet-700"}
      >
        {denisEnabled ? "Disable Denis" : "Enable Denis"}
      </Button>
    </div>
  );
}
