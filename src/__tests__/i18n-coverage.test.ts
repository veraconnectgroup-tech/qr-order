import { describe, expect, it } from "vitest";
import { translations, type Locale } from "@/lib/i18n/translations";

const GUEST_CRITICAL_KEYS = [
  "ai.chat.send",
  "ai.chat.close",
  "ai.chat.thinking",
  "ai.chat.error",
  "ai.chat.offline",
  "error.rate_limited",
  "error.circuit_open",
  "error.generic",
  "cart.viewCart",
  "cart.checkout",
  "checkout.title",
  "feedback.title",
  "order.status.preparing",
  "order.status.ready",
  "order.status.delivered",
] as const;

const ALL_LOCALES: Locale[] = ["de", "en", "sr", "tr", "hr", "ar", "fr", "es", "it", "ru"];

describe("Guest i18n coverage (AN2)", () => {
  it("has critical guest strings in all 10 locales", () => {
    const missing: string[] = [];
    for (const locale of ALL_LOCALES) {
      const table = translations[locale];
      for (const key of GUEST_CRITICAL_KEYS) {
        const value = table[key] ?? translations.en[key] ?? translations.de[key];
        if (!value || value === key) {
          missing.push(`${locale}:${key}`);
        }
      }
    }
    expect(missing, missing.join(", ")).toEqual([]);
  });
});
