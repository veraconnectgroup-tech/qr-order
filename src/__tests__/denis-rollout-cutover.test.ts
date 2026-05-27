import { describe, expect, it } from "vitest";
import { PartialConciergeConfigSchema } from "@/lib/denis/config/concierge-config.schema";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import {
  DENIS_ROLLOUT_PRESETS,
  denisRolloutFormFromPreset,
  denisRolloutPatchFromForm,
} from "@/lib/denis/config/rollout-cutover";

describe("Denis rollout cutover M25", () => {
  it("presets parse as valid partial config", () => {
    for (const preset of DENIS_ROLLOUT_PRESETS) {
      const parsed = PartialConciergeConfigSchema.safeParse(preset.patch);
      expect(parsed.success, preset.id).toBe(true);
    }
  });

  it("preset maps to form state", () => {
    const form = denisRolloutFormFromPreset("shadow_instrumented");
    expect(form?.rolloutMode).toBe("shadow");
    expect(form?.slotExtractEnabled).toBe(true);
    expect(form?.actSubmitEnabled).toBe(false);
  });

  it("merges location override without dropping version", () => {
    const patch = denisRolloutPatchFromForm({
      rolloutMode: "denis_only",
      narrateWithLlm: true,
      slotExtractEnabled: true,
      slotExtractWithLlm: false,
      returnGuestEnabled: false,
      voiceEnabled: false,
      actLayerEnabled: true,
      actDryRun: true,
      actSubmitEnabled: false,
    });
    const merged = mergePartialConciergeConfig(
      { version: 1, upsell: { foodAfterDrinks: false } },
      patch
    );
    expect(merged.version).toBe(1);
    expect(merged.rollout?.mode).toBe("denis_only");
    expect(merged.upsell?.foodAfterDrinks).toBe(false);
  });
});
