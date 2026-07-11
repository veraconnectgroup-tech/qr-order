import { describe, expect, it } from "vitest";
import { detectGuestFormalityDropRequest } from "@/lib/ai/guest-formality";

describe("detectGuestFormalityDropRequest", () => {
  it("detects common Serbian requests to drop formal address", () => {
    expect(detectGuestFormalityDropRequest("ne moraš da mi persiraš")).toBe(true);
    expect(detectGuestFormalityDropRequest("nemoj mi persirati molim te")).toBe(true);
    expect(detectGuestFormalityDropRequest("hajde na ti")).toBe(true);
    expect(detectGuestFormalityDropRequest("možemo na ti")).toBe(true);
    expect(detectGuestFormalityDropRequest("možeš mi ti")).toBe(true);
    expect(detectGuestFormalityDropRequest("pređimo na ti")).toBe(true);
    expect(detectGuestFormalityDropRequest("obraćaj mi se na ti")).toBe(true);
    expect(detectGuestFormalityDropRequest("zovi me na ti")).toBe(true);
  });

  it("is case-insensitive and tolerates diacritic-free typing", () => {
    expect(detectGuestFormalityDropRequest("NE MORAS DA MI PERSIRAS")).toBe(true);
    expect(detectGuestFormalityDropRequest("predjimo na ti")).toBe(true);
  });

  it("does not fire on unrelated or ordinary messages", () => {
    expect(detectGuestFormalityDropRequest("hteo bih jedno pivo molim")).toBe(false);
    expect(detectGuestFormalityDropRequest("koliko košta pica margarita")).toBe(false);
    expect(detectGuestFormalityDropRequest("hvala puno")).toBe(false);
    expect(detectGuestFormalityDropRequest("")).toBe(false);
    expect(detectGuestFormalityDropRequest("   ")).toBe(false);
  });
});
