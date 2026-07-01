import { describe, expect, it, vi } from "vitest";
import { runOptimisticOrderSubmit } from "@/lib/guest/optimistic-order-submit";

describe("optimistic order submit", () => {
  it("applies optimistic UI then commits on success", async () => {
    const onOptimistic = vi.fn();
    const onSuccess = vi.fn();
    const onRollback = vi.fn();

    const result = await runOptimisticOrderSubmit({
      onOptimistic,
      submit: async () => ({ orderId: "ord-1" }),
      onSuccess,
      onRollback,
    });

    expect(onOptimistic).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ orderId: "ord-1" });
    expect(onRollback).not.toHaveBeenCalled();
    expect(result).toEqual({ orderId: "ord-1" });
  });

  it("rolls back and surfaces error on failure", async () => {
    const onRollback = vi.fn();
    const onError = vi.fn();

    const result = await runOptimisticOrderSubmit({
      submit: async () => {
        throw new Error("Network error");
      },
      onSuccess: () => {},
      onRollback,
      onError,
    });

    expect(onRollback).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("Network error");
    expect(result).toBeNull();
  });
});
