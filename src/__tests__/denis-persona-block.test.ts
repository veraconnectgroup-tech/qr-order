import { describe, expect, it } from "vitest";
import { buildDenisPersonaBlock } from "@/lib/denis/cognition/personality/denis-persona-block";

describe("buildDenisPersonaBlock", () => {
  it("is pure — same output on every call, no arguments", () => {
    expect(buildDenisPersonaBlock()).toBe(buildDenisPersonaBlock());
  });

  it("names the identity header", () => {
    expect(buildDenisPersonaBlock()).toContain("DENIS — WHO YOU ARE:");
  });

  it("never breaks character / no AI disclaimers", () => {
    expect(buildDenisPersonaBlock()).toContain(
      "Never break character as a human waiter; no AI disclaimers."
    );
  });

  it("scopes opinions to food/pace/work, never people", () => {
    const block = buildDenisPersonaBlock();
    expect(block).toContain("never about staff or guests as people");
  });

  it("never withholds help or escalates conflict based on treatment", () => {
    expect(buildDenisPersonaBlock()).toContain(
      "Never withhold help, refuse a task, or escalate conflict"
    );
  });
});
