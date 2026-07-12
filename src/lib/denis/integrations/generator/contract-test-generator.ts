import type {
  ParsedApiSpec,
  ParsedEndpoint,
} from "@/lib/denis/integrations/parsers/parsed-api-spec-types";
import {
  resolveAdapterMethodName,
  type CapabilityManifest,
  type CapabilityRecord,
} from "@/lib/denis/integrations/capabilities/denis-capability-types";

/**
 * ADR-052 §F/§G — deterministic vitest source generation, layers 2
 * ("mock API test") and 3 ("contract test") from §G's 14-layer test
 * ladder. Reads resolveAdapterMethodName from the SAME shared table
 * adapter-generator.ts uses, so a test file this module produces can
 * never call a method name the adapter it's testing doesn't have.
 *
 * Output is a plain string, same posture as adapter-generator.ts — this
 * module never writes to disk or executes anything. Per ADR-052 §F,
 * generated code (adapter + this test file) only becomes real, runnable
 * files once a human has reviewed and approved them (§C steps 13-14) and
 * moved the adapter into src/lib/pos/adapters/ — adapterImportPath below
 * is where the caller expects that approved file to live.
 */

function findEndpoint(
  spec: ParsedApiSpec,
  endpointLabel: string | null
): ParsedEndpoint | null {
  if (!endpointLabel) return null;
  const [method, ...pathParts] = endpointLabel.split(" ");
  const path = pathParts.join(" ");
  return (
    spec.endpoints.find((e) => e.method === method && e.path === path) ?? null
  );
}

function stubInputForEndpoint(endpoint: ParsedEndpoint): Record<string, unknown> {
  const pathParams: Record<string, string> = {};
  for (const match of endpoint.path.matchAll(/\{([^}]+)\}/g)) {
    pathParams[match[1]] = "test-id";
  }
  const requestExample =
    endpoint.requestExample && typeof endpoint.requestExample === "object"
      ? (endpoint.requestExample as Record<string, unknown>)
      : {};
  return { ...requestExample, ...pathParams };
}

function renderCase(record: CapabilityRecord, endpoint: ParsedEndpoint): string {
  const methodName = resolveAdapterMethodName(record.capability);
  const stubInput = stubInputForEndpoint(endpoint);
  const mockResponse = endpoint.responseExample ?? { ok: true };

  return [
    `  describe(${JSON.stringify(`${methodName} (${record.capability})`)}, () => {`,
    `    it("returns ok:true with the response body on a successful call", async () => {`,
    `      const fetchMock = vi.fn().mockResolvedValue({`,
    `        ok: true,`,
    `        status: 200,`,
    `        json: async () => (${JSON.stringify(mockResponse)}),`,
    `      });`,
    `      vi.stubGlobal("fetch", fetchMock);`,
    "",
    `      const adapter = new Adapter();`,
    `      const result = await adapter.${methodName}(${JSON.stringify(stubInput)}, TEST_CONFIG);`,
    "",
    `      expect(fetchMock).toHaveBeenCalledTimes(1);`,
    `      expect(fetchMock.mock.calls[0][1]?.method).toBe(${JSON.stringify(endpoint.method)});`,
    `      expect(result).toEqual({ ok: true, data: ${JSON.stringify(mockResponse)} });`,
    "",
    `      vi.unstubAllGlobals();`,
    `    });`,
    "",
    `    it("returns ok:false on a non-2xx response, never a false success", async () => {`,
    `      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });`,
    `      vi.stubGlobal("fetch", fetchMock);`,
    "",
    `      const adapter = new Adapter();`,
    `      const result = await adapter.${methodName}(${JSON.stringify(stubInput)}, TEST_CONFIG);`,
    "",
    `      expect(result.ok).toBe(false);`,
    "",
    `      vi.unstubAllGlobals();`,
    `    });`,
    `  });`,
  ].join("\n");
}

export function generateContractTestSource(input: {
  adapterImportPath: string;
  adapterClassName: string;
  spec: ParsedApiSpec;
  manifest: CapabilityManifest;
}): string {
  const supportedRecords = input.manifest.records.filter(
    (r) => r.status === "supported"
  );

  const cases = supportedRecords
    .map((record) => {
      const endpoint = findEndpoint(input.spec, record.endpoint);
      return endpoint ? renderCase(record, endpoint) : null;
    })
    .filter((c): c is string => c !== null);

  return [
    "/**",
    " * AI-generated draft contract test — ADR-052 Integration Builder.",
    " * Only meaningful once the adapter it imports has been human-reviewed",
    " * and moved into place (ADR-052 §C steps 13-14) — this file assumes",
    " * that has already happened.",
    " */",
    'import { describe, expect, it, vi } from "vitest";',
    `import { ${input.adapterClassName} as Adapter } from ${JSON.stringify(input.adapterImportPath)};`,
    "",
    "const TEST_CONFIG: Record<string, unknown> = {};",
    "",
    `describe(${JSON.stringify(`${input.manifest.provider} adapter contract`)}, () => {`,
    cases.length > 0 ? cases.join("\n\n") : "  it.todo(\"no supported capabilities to test\");",
    "});",
    "",
  ].join("\n");
}
