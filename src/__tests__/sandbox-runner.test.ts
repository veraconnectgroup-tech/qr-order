import { describe, expect, it } from "vitest";
import { runAdapterMethodInSandbox } from "@/lib/denis/integrations/sandbox/sandbox-runner";
import { generateAdapterSource } from "@/lib/denis/integrations/generator/adapter-generator";
import { mapCapabilities } from "@/lib/denis/integrations/capabilities/capability-mapper";
import type { ParsedApiSpec } from "@/lib/denis/integrations/parsers/parsed-api-spec-types";

describe("runAdapterMethodInSandbox — end to end with a real generated adapter", () => {
  const spec: ParsedApiSpec = {
    title: "Acme POS API",
    version: "1.0",
    baseUrl: "https://api.acme.example.com/v1",
    securitySchemes: [{ kind: "apiKey", in: "header", name: "X-Api-Key" }],
    endpoints: [
      {
        method: "POST",
        path: "/orders",
        operationId: "createOrder",
        summary: null,
        description: null,
        requestExample: null,
        responseExample: null,
        tags: [],
      },
    ],
    sourceFormat: "openapi",
  };

  const manifest = mapCapabilities("acme", [
    {
      capability: "order.create",
      status: "supported",
      endpoint: "POST /orders",
      quotedSpan: "POST /orders",
      source: "heuristic",
      confidence: 0.75,
    },
  ]);

  const adapterSource = generateAdapterSource(spec, manifest);

  it("runs createOrder against a mock 200 response and returns the mocked body", async () => {
    const result = await runAdapterMethodInSandbox({
      adapterSource,
      adapterClassName: "AcmeAdapter",
      methodName: "createOrder",
      methodInput: { tableId: "5" },
      methodConfig: { apiKey: "test-key" },
      mockResponses: [{ status: 200, body: { orderId: "abc123" } }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toEqual({ ok: true, data: { orderId: "abc123" } });
      expect(result.fetchCalls).toHaveLength(1);
      expect(result.fetchCalls[0].url).toBe("https://api.acme.example.com/v1/orders");
      expect(result.fetchCalls[0].method).toBe("POST");
      expect(result.fetchCalls[0].hasBody).toBe(true);
    }
  });

  it("never reports ok:true when the mock response is non-2xx", async () => {
    const result = await runAdapterMethodInSandbox({
      adapterSource,
      adapterClassName: "AcmeAdapter",
      methodName: "createOrder",
      methodInput: { tableId: "5" },
      methodConfig: { apiKey: "test-key" },
      mockResponses: [{ status: 500, body: {} }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toEqual({ ok: false, error: "HTTP 500" });
    }
  });

  it("never touches the real network — the sandbox's fetch is the only one that ever runs", async () => {
    const originalFetch = globalThis.fetch;
    let realFetchCalled = false;
    globalThis.fetch = (async () => {
      realFetchCalled = true;
      throw new Error("real fetch must never be reachable from the sandbox");
    }) as typeof fetch;

    try {
      await runAdapterMethodInSandbox({
        adapterSource,
        adapterClassName: "AcmeAdapter",
        methodName: "createOrder",
        methodInput: {},
        methodConfig: {},
        mockResponses: [{ status: 200, body: {} }],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(realFetchCalled).toBe(false);
  });

  it("returns an error for a method name that doesn't exist on the adapter", async () => {
    const result = await runAdapterMethodInSandbox({
      adapterSource,
      adapterClassName: "AcmeAdapter",
      methodName: "deleteEverything",
      methodInput: {},
      methodConfig: {},
      mockResponses: [{ status: 200, body: {} }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not found");
  });

  it("returns an error for a class name that doesn't exist in the generated source", async () => {
    const result = await runAdapterMethodInSandbox({
      adapterSource,
      adapterClassName: "NotARealClass",
      methodName: "createOrder",
      methodInput: {},
      methodConfig: {},
      mockResponses: [{ status: 200, body: {} }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not found");
  });
});

describe("runAdapterMethodInSandbox — defense in depth", () => {
  it("rejects source referencing require() before ever executing anything", async () => {
    const maliciousSource = `
      export class EvilAdapter {
        async doThing() {
          const fs = require("fs");
          return fs.readFileSync("/etc/passwd", "utf8");
        }
      }
    `;

    const result = await runAdapterMethodInSandbox({
      adapterSource: maliciousSource,
      adapterClassName: "EvilAdapter",
      methodName: "doThing",
      methodInput: {},
      methodConfig: {},
      mockResponses: [{ status: 200, body: {} }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("forbidden");
  });

  it("rejects source referencing process", async () => {
    const maliciousSource = `
      export class EvilAdapter {
        async doThing() {
          return process.env;
        }
      }
    `;

    const result = await runAdapterMethodInSandbox({
      adapterSource: maliciousSource,
      adapterClassName: "EvilAdapter",
      methodName: "doThing",
      methodInput: {},
      methodConfig: {},
      mockResponses: [{ status: 200, body: {} }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("forbidden");
  });

  it("times out a method that never resolves, instead of hanging forever", async () => {
    const hangingSource = `
      export class SlowAdapter {
        async doThing() {
          return new Promise(() => {});
        }
      }
    `;

    const result = await runAdapterMethodInSandbox({
      adapterSource: hangingSource,
      adapterClassName: "SlowAdapter",
      methodName: "doThing",
      methodInput: {},
      methodConfig: {},
      mockResponses: [{ status: 200, body: {} }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("exceeded");
  }, 10_000);

  it("reports a transpile error instead of throwing for invalid syntax", async () => {
    const result = await runAdapterMethodInSandbox({
      adapterSource: "export class {{{ not valid typescript",
      adapterClassName: "Whatever",
      methodName: "x",
      methodInput: {},
      methodConfig: {},
      mockResponses: [{ status: 200, body: {} }],
    });

    expect(result.ok).toBe(false);
  });
});
