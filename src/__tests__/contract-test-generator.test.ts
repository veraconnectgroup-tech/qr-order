import { describe, expect, it } from "vitest";
import { generateContractTestSource } from "@/lib/denis/integrations/generator/contract-test-generator";
import { mapCapabilities } from "@/lib/denis/integrations/capabilities/capability-mapper";
import type { ParsedApiSpec } from "@/lib/denis/integrations/parsers/parsed-api-spec-types";

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
      summary: "Create an order",
      description: null,
      requestExample: { tableId: "5" },
      responseExample: { orderId: "abc123", status: "created" },
      tags: [],
    },
    {
      method: "GET",
      path: "/orders/{id}",
      operationId: "getOrder",
      summary: "Get order status",
      description: null,
      requestExample: null,
      responseExample: { status: "preparing" },
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
  {
    capability: "order.status.read",
    status: "supported",
    endpoint: "GET /orders/{id}",
    quotedSpan: "GET /orders/{id}",
    source: "heuristic",
    confidence: 0.75,
  },
  {
    capability: "payment.refund",
    status: "supported",
    endpoint: "POST /refunds",
    quotedSpan: "",
    source: "llm",
    confidence: 0.9,
  },
]);

describe("generateContractTestSource", () => {
  it("imports the adapter from the given path under the given class name", () => {
    const source = generateContractTestSource({
      adapterImportPath: "@/lib/pos/adapters/acme",
      adapterClassName: "AcmeAdapter",
      spec,
      manifest,
    });
    expect(source).toContain(
      'import { AcmeAdapter as Adapter } from "@/lib/pos/adapters/acme";'
    );
  });

  it("generates a describe block per supported capability, none for unknown ones", () => {
    const source = generateContractTestSource({
      adapterImportPath: "@/lib/pos/adapters/acme",
      adapterClassName: "AcmeAdapter",
      spec,
      manifest,
    });
    expect(source).toContain("createOrder (order.create)");
    expect(source).toContain("getOrderStatus (order.status.read)");
    expect(source).not.toContain("refundPayment");
  });

  it("substitutes path params into the stub input for a param-carrying endpoint", () => {
    const source = generateContractTestSource({
      adapterImportPath: "@/lib/pos/adapters/acme",
      adapterClassName: "AcmeAdapter",
      spec,
      manifest,
    });
    expect(source).toContain('"id":"test-id"');
  });

  it("uses the endpoint's own response example as the mocked fetch response", () => {
    const source = generateContractTestSource({
      adapterImportPath: "@/lib/pos/adapters/acme",
      adapterClassName: "AcmeAdapter",
      spec,
      manifest,
    });
    expect(source).toContain('"orderId":"abc123"');
  });

  it("emits a placeholder test when there are no supported capabilities", () => {
    const source = generateContractTestSource({
      adapterImportPath: "@/lib/pos/adapters/acme",
      adapterClassName: "AcmeAdapter",
      spec,
      manifest: { provider: "acme", records: [] },
    });
    expect(source).toContain("it.todo(");
  });
});
