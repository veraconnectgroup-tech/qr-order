import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CircuitOpenError,
  resetCircuitBreakerForTests,
  resolveCircuitState,
  withCircuitBreaker,
} from "@/lib/resilience/circuit-breaker";

describe("circuit-breaker", () => {
  afterEach(() => {
    resetCircuitBreakerForTests("test-service");
    vi.restoreAllMocks();
  });

  it("returns fn result when circuit is closed", async () => {
    const result = await withCircuitBreaker("test-service", async () => "ok");
    expect(result).toBe("ok");
  });

  it("opens after threshold failures", async () => {
    const failing = () =>
      withCircuitBreaker("test-service", async () => {
        throw new Error("boom");
      });

    await expect(failing()).rejects.toThrow("boom");
    await expect(failing()).rejects.toThrow("boom");
    await expect(failing()).rejects.toThrow("boom");

    await expect(
      withCircuitBreaker("test-service", async () => "late")
    ).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("uses fallback when circuit is open", async () => {
    for (let i = 0; i < 3; i++) {
      await expect(
        withCircuitBreaker("test-service", async () => {
          throw new Error("fail");
        })
      ).rejects.toThrow("fail");
    }

    const result = await withCircuitBreaker(
      "test-service",
      async () => "unused",
      () => "fallback"
    );
    expect(result).toBe("fallback");
  });

  it("resolves HALF_OPEN after openUntil expires", () => {
    const now = 1_000_000;
    expect(
      resolveCircuitState({ failures: 3, openUntil: now + 5_000 }, now)
    ).toBe("OPEN");
    expect(
      resolveCircuitState({ failures: 3, openUntil: now - 1 }, now)
    ).toBe("HALF_OPEN");
    expect(resolveCircuitState({ failures: 0, openUntil: 0 }, now)).toBe(
      "CLOSED"
    );
  });
});
