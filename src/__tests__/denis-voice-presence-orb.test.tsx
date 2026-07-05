import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DenisVoicePresenceOrb } from "@/components/design-system/denis-voice-presence-orb";

describe("DenisVoicePresenceOrb", () => {
  it("renders the soft cloud orb with inline gradients (browser-safe)", () => {
    const { container } = render(
      <DenisVoicePresenceOrb moodIntensity={0.2} speaking={false} size={220} />
    );
    const orb = container.firstElementChild as HTMLElement | null;
    expect(orb).not.toBeNull();
    expect(orb!.className).toContain("denis-voice-orb");
    expect(orb!.className).toContain("rounded-full");
    expect(orb!.className).not.toContain("denis-orb2");
    expect(orb!.style.width).toBe("220px");
    expect(orb!.style.height).toBe("220px");
    expect(orb!.style.background).toContain("radial-gradient");
    expect(orb!.style.boxShadow).toContain("rgb");
  });

  it("shifts toward alert red at max urgency", () => {
    const { container } = render(
      <DenisVoicePresenceOrb moodIntensity={1} speaking={true} size={220} />
    );
    const orb = container.firstElementChild as HTMLElement;
    expect(orb.className).toContain("denis-voice-orb--speaking");
    expect(orb.style.background).toContain("220, 38, 38");
  });
});
