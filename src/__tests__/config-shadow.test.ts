import { describe, expect, it } from "vitest";
import { applyConfigShadowPatch } from "@/lib/denis/config/config-shadow";

describe("applyConfigShadowPatch", () => {
  it("merges shadow patch over location partial", () => {
    const merged = applyConfigShadowPatch(
      {
        proactive: { enabled: false, browseNudgeMinutes: 3, billPromptMinutes: 45 },
      },
      {
        proactive: { enabled: true, browseNudgeMinutes: 6 },
      }
    );

    expect(merged?.proactive?.enabled).toBe(true);
    expect(merged?.proactive?.browseNudgeMinutes).toBe(6);
    expect(merged?.proactive?.billPromptMinutes).toBe(45);
  });

  it("returns location partial when shadow is empty", () => {
    expect(
      applyConfigShadowPatch({ ordering: { actDryRun: true } }, null)?.ordering
        ?.actDryRun
    ).toBe(true);
  });
});
