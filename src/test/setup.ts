import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

vi.mock("server-only", () => ({}));

function deepFreeze<T extends object>(obj: T): T {
  if (Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      deepFreeze(value);
    }
  }
  return obj;
}

deepFreeze(CONCIERGE_PLATFORM_DEFAULTS);

afterEach(() => {
  vi.useRealTimers();
});
