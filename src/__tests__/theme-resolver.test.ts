import { describe, expect, it } from "vitest";
import { buildGuestThemeStyleBlock } from "@/components/theme/venue-theme-provider";
import {
  buildThemeCssVars,
  replaceConciergeDisplayName,
  resolveTheme,
  themeColorSchemeAttribute,
  themeMetaColor,
} from "@/lib/theme/theme-resolver";
import { DEFAULT_THEME } from "@/lib/theme/types";

describe("resolveTheme", () => {
  it("applies red brand color to CSS variables", () => {
    const theme = resolveTheme({
      orgName: "Mario's",
      theme: { primaryColor: "#ff0000" },
    });

    expect(theme.primaryColor).toBe("#ff0000");
    expect(theme.cssVars["--qr-ember"]).toBe("#ff0000");
    expect(theme.cssVars["--dash-accent"]).toBe("#ff0000");
    expect(theme.cssVarStyle).toContain("--qr-ember:#ff0000");
  });

  it("uses custom concierge display name from persona", () => {
    const theme = resolveTheme({
      orgName: "Trattoria",
      displayName: "Mario",
    });

    expect(theme.displayName).toBe("Mario");
  });

  it("falls back to Denis when display name is empty", () => {
    const theme = resolveTheme({
      orgName: "Trattoria",
      displayName: "  ",
    });

    expect(theme.displayName).toBe(DEFAULT_THEME.displayName);
  });

  it("reads legacy brandPrimaryColor when theme block is missing", () => {
    const theme = resolveTheme({
      orgName: "Venue",
      brandPrimaryColor: "#cc0000",
    });

    expect(theme.primaryColor).toBe("#cc0000");
  });

  it("respects enterprise hidePoweredBy and custom footer", () => {
    const theme = resolveTheme({
      orgName: "Enterprise Co",
      theme: {
        hidePoweredBy: true,
        receiptFooter: "Arrivederci!",
        poweredByLabel: "Powered by Vera IT",
      },
    });

    expect(theme.hidePoweredBy).toBe(true);
    expect(theme.receiptFooter).toBe("Arrivederci!");
  });
});

describe("replaceConciergeDisplayName", () => {
  it("replaces Denis with Mario in UI copy", () => {
    expect(
      replaceConciergeDisplayName("Frag Denis…", "Mario")
    ).toBe("Frag Mario…");
    expect(
      replaceConciergeDisplayName("Ask Denis", "Mario")
    ).toBe("Ask Mario");
  });

  it("leaves text unchanged when display name is Denis", () => {
    expect(
      replaceConciergeDisplayName("Frag Denis…", "Denis")
    ).toBe("Frag Denis…");
  });
});

describe("buildThemeCssVars", () => {
  it("boosts contrast when highContrast is enabled", () => {
    const normal = buildThemeCssVars({
      primaryColor: "#e85d04",
      secondaryColor: "#c2410c",
      fontFamily: "Inter",
    });
    const high = buildThemeCssVars({
      primaryColor: "#e85d04",
      secondaryColor: "#c2410c",
      fontFamily: "Inter",
      highContrast: true,
    });

    expect(high["--qr-ember-muted"]).not.toBe(normal["--qr-ember-muted"]);
  });
});

describe("themeColorSchemeAttribute", () => {
  it("returns undefined for auto (follows device)", () => {
    expect(themeColorSchemeAttribute("auto")).toBeUndefined();
    expect(themeColorSchemeAttribute("dark")).toBe("dark");
    expect(themeColorSchemeAttribute("light")).toBe("light");
  });
});

describe("buildGuestThemeStyleBlock", () => {
  it("emits prefers-color-scheme media query for auto mode", () => {
    const theme = resolveTheme({
      orgName: "Venue",
      theme: { primaryColor: "#ff0000", colorScheme: "auto" },
    });

    const block = buildGuestThemeStyleBlock(theme);
    expect(block).toContain("@media (prefers-color-scheme:light)");
    expect(block).toContain("--qr-ember:#ff0000");
  });

  it("applies light scheme directly when configured", () => {
    const theme = resolveTheme({
      orgName: "Venue",
      theme: { colorScheme: "light" },
    });

    const block = buildGuestThemeStyleBlock(theme);
    expect(block).toContain("color-scheme:light");
    expect(block).not.toContain("@media (prefers-color-scheme:light)");
  });
});

describe("themeMetaColor", () => {
  it("uses primary brand color for viewport theme-color", () => {
    const theme = resolveTheme({
      orgName: "Venue",
      theme: { primaryColor: "#ff0000" },
    });

    expect(themeMetaColor(theme)).toBe("#ff0000");
  });
});
