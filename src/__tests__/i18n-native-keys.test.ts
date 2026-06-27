import { describe, expect, it } from "vitest";
import { translations, type Locale } from "@/lib/i18n/translations";

/** Keys that must exist natively in each locale (no en/de fallback). */
const NATIVE_REQUIRED: Partial<Record<Locale, string[]>> = {
  sr: ["ai.chat.error", "ai.chat.offline", "error.rate_limited", "error.circuit_open"],
  tr: ["ai.chat.error", "ai.chat.offline", "error.rate_limited", "error.circuit_open"],
  hr: ["ai.chat.error", "ai.chat.offline", "error.rate_limited", "error.circuit_open"],
  fr: ["error.rate_limited", "error.circuit_open"],
  es: ["error.rate_limited", "error.circuit_open"],
  it: ["error.rate_limited", "error.circuit_open"],
  ru: ["error.rate_limited", "error.circuit_open"],
  ar: ["error.rate_limited", "error.circuit_open"],
};

describe("Guest i18n native keys (AN2)", () => {
  for (const [locale, keys] of Object.entries(NATIVE_REQUIRED)) {
    it(`${locale} has native critical strings`, () => {
      const table = translations[locale as Locale];
      for (const key of keys ?? []) {
        expect(table[key], `${locale}:${key}`).toBeTruthy();
        expect(table[key]).not.toBe(key);
      }
    });
  }
});
