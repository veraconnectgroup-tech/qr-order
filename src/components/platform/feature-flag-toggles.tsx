"use client";

import { useTransition } from "react";
import {
  FEATURE_LABELS,
  PLATFORM_FEATURES,
  parseFeatureFlags,
  type PlatformFeature,
} from "@/lib/platform/feature-flags";
import { toggleOrgFeature } from "@/lib/platform/platform-actions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Json } from "@/types/database";

export function FeatureFlagToggles({
  orgId,
  featureFlags,
}: {
  orgId: string;
  featureFlags: Json;
}) {
  const [pending, startTransition] = useTransition();
  const flags = parseFeatureFlags(featureFlags);

  function handleToggle(flag: PlatformFeature, checked: boolean) {
    startTransition(async () => {
      await toggleOrgFeature(orgId, flag, checked);
    });
  }

  return (
    <div className="space-y-4">
      {PLATFORM_FEATURES.map((flag) => (
        <div
          key={flag}
          className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3"
        >
          <Label htmlFor={flag} className="text-sm font-medium">
            {FEATURE_LABELS[flag]}
          </Label>
          <Switch
            id={flag}
            checked={flag in flags ? flags[flag] === true : true}
            disabled={pending}
            onCheckedChange={(checked) => handleToggle(flag, checked)}
          />
        </div>
      ))}
    </div>
  );
}
