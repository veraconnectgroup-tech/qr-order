import { afterEach, describe, expect, it, vi } from "vitest";

const proposeAdapterPatch = vi.fn();
vi.mock("@/lib/denis/cognition/perceive/propose-adapter-patch", () => ({
  proposeAdapterPatch: (...args: unknown[]) => proposeAdapterPatch(...args),
}));

import { runAdapterRepairLoop } from "@/lib/denis/integrations/repair/repair-loop";

const WORKING_SOURCE = `
export class AcmeAdapter {
  async createOrder(input: Record<string, unknown>, config: Record<string, unknown>) {
    const response = await fetch("https://api.acme.example.com/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) return { ok: false, error: \`HTTP \${response.status}\` };
    const data = await response.json();
    return { ok: true, data };
  }
}
`;

// Real bug shape: calls a method name ("createOrder") that doesn't exist
// on the class (typo'd as "createOrdr") — sandbox-runner reports
// "method not found", a genuine, fixable class of error.
const BROKEN_SOURCE = `
export class AcmeAdapter {
  async createOrdr(input: Record<string, unknown>, config: Record<string, unknown>) {
    return { ok: true, data: {} };
  }
}
`;

const baseInput = {
  initialSource: BROKEN_SOURCE,
  adapterClassName: "AcmeAdapter",
  methodName: "createOrder",
  methodInput: { tableId: "5" },
  methodConfig: {},
  mockResponses: [{ status: 200, body: { orderId: "abc123" } }],
};

describe("runAdapterRepairLoop", () => {
  afterEach(() => {
    proposeAdapterPatch.mockReset();
  });

  it("returns immediately, no repair attempts, when the initial source already works", async () => {
    const result = await runAdapterRepairLoop({
      ...baseInput,
      initialSource: WORKING_SOURCE,
    });

    expect(result.succeeded).toBe(true);
    expect(result.attempts).toHaveLength(0);
    expect(proposeAdapterPatch).not.toHaveBeenCalled();
  });

  it("succeeds after one valid patch that fixes the real bug", async () => {
    proposeAdapterPatch.mockResolvedValueOnce({
      revisedSource: WORKING_SOURCE,
      explanation: "Renamed createOrdr to createOrder.",
    });

    const result = await runAdapterRepairLoop(baseInput);

    expect(result.succeeded).toBe(true);
    expect(result.finalSource).toBe(WORKING_SOURCE);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({
      attemptNumber: 1,
      proposed: true,
      validationPassed: true,
      sandboxPassed: true,
    });
  });

  it("stops immediately (no rounds burned) when the LLM proposes nothing", async () => {
    proposeAdapterPatch.mockResolvedValueOnce(null);

    const result = await runAdapterRepairLoop(baseInput);

    expect(result.succeeded).toBe(false);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].proposed).toBe(false);
    expect(proposeAdapterPatch).toHaveBeenCalledTimes(1);
  });

  it("rejects a syntactically invalid patch via static validation, then moves to the next round", async () => {
    proposeAdapterPatch
      .mockResolvedValueOnce({
        revisedSource: "export class {{{ not valid at all",
        explanation: "garbage",
      })
      .mockResolvedValueOnce({
        revisedSource: WORKING_SOURCE,
        explanation: "Actually fixed it this time.",
      });

    const result = await runAdapterRepairLoop(baseInput);

    expect(result.succeeded).toBe(true);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0].validationPassed).toBe(false);
    expect(result.attempts[0].sandboxPassed).toBe(false);
    expect(result.attempts[1].sandboxPassed).toBe(true);
  });

  it("rejects a patch that renames the class away (still validates syntax, fails the class-identity check)", async () => {
    proposeAdapterPatch.mockResolvedValue({
      revisedSource: WORKING_SOURCE.replace("AcmeAdapter", "SomethingElseAdapter"),
      explanation: "Renamed the class for no good reason.",
    });

    const result = await runAdapterRepairLoop(baseInput);

    expect(result.attempts.every((a) => a.validationPassed === false)).toBe(true);
    expect(result.succeeded).toBe(false);
  });

  it("gives up after exactly 3 rounds when every patch still fails in the sandbox", async () => {
    proposeAdapterPatch.mockResolvedValue({
      revisedSource: BROKEN_SOURCE,
      explanation: "Didn't actually change anything meaningful.",
    });

    const result = await runAdapterRepairLoop(baseInput);

    expect(result.succeeded).toBe(false);
    expect(result.attempts).toHaveLength(3);
    expect(proposeAdapterPatch).toHaveBeenCalledTimes(3);
    expect(result.attempts.every((a) => a.sandboxPassed === false)).toBe(true);
  });
});
