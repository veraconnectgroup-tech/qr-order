import { describe, expect, it } from "vitest";
import { matchCapabilityHeuristic } from "@/lib/denis/integrations/capabilities/match-capability-heuristic";
import { mapCapabilities } from "@/lib/denis/integrations/capabilities/capability-mapper";
import { generateZodSchemaSource } from "@/lib/denis/integrations/generator/schema-validator";
import { generateAdapterSource } from "@/lib/denis/integrations/generator/adapter-generator";
import type { CapabilityProposal } from "@/lib/denis/integrations/capabilities/denis-capability-types";
import type { ParsedApiSpec } from "@/lib/denis/integrations/parsers/parsed-api-spec-types";

describe("matchCapabilityHeuristic", () => {
  it("maps POST /orders to order.create", () => {
    const result = matchCapabilityHeuristic({
      method: "POST",
      path: "/orders",
      operationId: "createOrder",
      summary: null,
      description: null,
      requestExample: null,
      responseExample: null,
      tags: [],
    });
    expect(result?.capability).toBe("order.create");
    expect(result?.quotedSpan).toBe("POST /orders");
    expect(result?.source).toBe("heuristic");
  });

  it("maps GET /orders/{id} to order.status.read (path param disambiguates from create)", () => {
    const result = matchCapabilityHeuristic({
      method: "GET",
      path: "/orders/{id}",
      operationId: null,
      summary: null,
      description: null,
      requestExample: null,
      responseExample: null,
      tags: [],
    });
    expect(result?.capability).toBe("order.status.read");
  });

  it("maps POST /orders/{id}/cancel to order.cancel, not order.create", () => {
    const result = matchCapabilityHeuristic({
      method: "POST",
      path: "/orders/{id}/cancel",
      operationId: null,
      summary: null,
      description: null,
      requestExample: null,
      responseExample: null,
      tags: [],
    });
    expect(result?.capability).toBe("order.cancel");
  });

  it("maps GET /tables to table.list and GET /tables/{id} to table.status.read", () => {
    const list = matchCapabilityHeuristic({
      method: "GET",
      path: "/tables",
      operationId: null,
      summary: null,
      description: null,
      requestExample: null,
      responseExample: null,
      tags: [],
    });
    const status = matchCapabilityHeuristic({
      method: "GET",
      path: "/tables/{id}",
      operationId: null,
      summary: null,
      description: null,
      requestExample: null,
      responseExample: null,
      tags: [],
    });
    expect(list?.capability).toBe("table.list");
    expect(status?.capability).toBe("table.status.read");
  });

  it("returns null for a generic, unrecognizable endpoint (no forced guess)", () => {
    const result = matchCapabilityHeuristic({
      method: "GET",
      path: "/webhooks/config",
      operationId: null,
      summary: null,
      description: null,
      requestExample: null,
      responseExample: null,
      tags: [],
    });
    expect(result).toBeNull();
  });
});

describe("mapCapabilities", () => {
  it("keeps a proposal with a quotedSpan and sufficient confidence as supported", () => {
    const proposals: CapabilityProposal[] = [
      {
        capability: "order.create",
        status: "supported",
        endpoint: "POST /orders",
        quotedSpan: "POST /orders",
        source: "heuristic",
        confidence: 0.75,
      },
    ];
    const manifest = mapCapabilities("acme", proposals);
    expect(manifest.records).toHaveLength(1);
    expect(manifest.records[0].status).toBe("supported");
    expect(manifest.records[0].quotedSpan).toBe("POST /orders");
    expect(manifest.records[0].sideEffectLevel).toBe("mutating");
  });

  it("downgrades a proposal with no quotedSpan to unknown — never supported without a citation", () => {
    const proposals: CapabilityProposal[] = [
      {
        capability: "bill.close",
        status: "supported",
        endpoint: "POST /bills/close",
        quotedSpan: "",
        source: "llm",
        confidence: 0.9,
      },
    ];
    const manifest = mapCapabilities("acme", proposals);
    expect(manifest.records[0].status).toBe("unknown");
    expect(manifest.records[0].endpoint).toBeNull();
    expect(manifest.records[0].quotedSpan).toBeNull();
  });

  it("downgrades a low-confidence proposal to unknown even with a quotedSpan", () => {
    const proposals: CapabilityProposal[] = [
      {
        capability: "payment.refund",
        status: "supported",
        endpoint: "POST /refunds",
        quotedSpan: "refund a payment",
        source: "llm",
        confidence: 0.2,
      },
    ];
    const manifest = mapCapabilities("acme", proposals);
    expect(manifest.records[0].status).toBe("unknown");
  });

  it("financial capabilities always require confirmation", () => {
    const proposals: CapabilityProposal[] = [
      {
        capability: "bill.apply_payment",
        status: "supported",
        endpoint: "POST /payments",
        quotedSpan: "POST /payments",
        source: "heuristic",
        confidence: 0.75,
      },
    ];
    const manifest = mapCapabilities("acme", proposals);
    expect(manifest.records[0].confirmationRequired).toBe(true);
    expect(manifest.records[0].sideEffectLevel).toBe("financial");
  });

  it("picks the heuristic proposal over an equal-confidence LLM proposal for the same capability", () => {
    const proposals: CapabilityProposal[] = [
      {
        capability: "menu.read",
        status: "supported",
        endpoint: "GET /menu",
        quotedSpan: "GET /menu",
        source: "heuristic",
        confidence: 0.75,
      },
      {
        capability: "menu.read",
        status: "supported",
        endpoint: "GET /catalog",
        quotedSpan: "catalog listing",
        source: "llm",
        confidence: 0.75,
      },
    ];
    const manifest = mapCapabilities("acme", proposals);
    expect(manifest.records).toHaveLength(1);
    expect(manifest.records[0].endpoint).toBe("GET /menu");
  });
});

describe("generateZodSchemaSource", () => {
  it("returns null when there's no example to infer from", () => {
    expect(generateZodSchemaSource("Foo", null)).toBeNull();
  });

  it("infers an object schema from a JSON example", () => {
    const source = generateZodSchemaSource("CreatePetRequest", {
      name: "Rex",
      age: 3,
      active: true,
      tags: ["dog"],
    });
    expect(source).toContain("export const CreatePetRequest = z.object({");
    expect(source).toContain('"name": z.string()');
    expect(source).toContain('"age": z.number()');
    expect(source).toContain('"active": z.boolean()');
    expect(source).toContain('"tags": z.array(z.string())');
  });
});

describe("generateAdapterSource", () => {
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
        requestExample: null,
        responseExample: null,
        tags: [],
      },
      {
        method: "GET",
        path: "/orders/{id}",
        operationId: "getOrder",
        summary: "Get order status",
        description: null,
        requestExample: null,
        responseExample: null,
        tags: [],
      },
    ],
    sourceFormat: "openapi",
  };

  it("generates a method only for supported capabilities, not unknown ones", () => {
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
        capability: "payment.refund",
        status: "supported",
        endpoint: "POST /refunds",
        quotedSpan: "",
        source: "llm",
        confidence: 0.9,
      },
    ]);
    const source = generateAdapterSource(spec, manifest);
    expect(source).toContain("export class AcmeAdapter");
    expect(source).toContain("async createOrder(");
    expect(source).not.toContain("refundPayment");
  });

  it("generates apiKey header auth from the spec's security scheme", () => {
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
    const source = generateAdapterSource(spec, manifest);
    expect(source).toContain('"X-Api-Key": apiKey');
  });

  it("substitutes path params from input in generated fetch calls", () => {
    const manifest = mapCapabilities("acme", [
      {
        capability: "order.status.read",
        status: "supported",
        endpoint: "GET /orders/{id}",
        quotedSpan: "GET /orders/{id}",
        source: "heuristic",
        confidence: 0.75,
      },
    ]);
    const source = generateAdapterSource(spec, manifest);
    expect(source).toContain("async getOrderStatus(");
    expect(source).toContain('encodeURIComponent(String(input["id"]))');
  });

  it("wraps a malicious path segment as an inert JSON-escaped string, never a raw template literal (template injection)", () => {
    const maliciousPath = '/orders`); process.exit(1); const x=(`';
    const evilSpec: ParsedApiSpec = {
      ...spec,
      endpoints: [
        {
          method: "GET",
          path: maliciousPath,
          operationId: null,
          summary: null,
          description: null,
          requestExample: null,
          responseExample: null,
          tags: [],
        },
      ],
    };
    const manifest = mapCapabilities("acme", [
      {
        capability: "order.status.read",
        status: "supported",
        endpoint: `GET ${maliciousPath}`,
        quotedSpan: "GET .../orders...",
        source: "heuristic",
        confidence: 0.75,
      },
    ]);
    const source = generateAdapterSource(evilSpec, manifest);
    // The whole path — backticks and all — must appear as a single
    // JSON-escaped argument to string concatenation, never spliced raw
    // into a template literal (the pre-fix vulnerability).
    expect(source).toContain(`fetch(this.baseUrl + ${JSON.stringify(maliciousPath)}`);
    expect(source).not.toContain("fetch(`");
  });

  it("never lets a malicious path break out of the generated doc comment", () => {
    const maliciousPath = "/orders*/ export const pwned = 1; /*";
    const evilSpec: ParsedApiSpec = {
      ...spec,
      endpoints: [
        {
          method: "GET",
          path: maliciousPath,
          operationId: null,
          summary: null,
          description: null,
          requestExample: null,
          responseExample: null,
          tags: [],
        },
      ],
    };
    const manifest = mapCapabilities("acme", [
      {
        capability: "order.status.read",
        status: "supported",
        endpoint: `GET ${maliciousPath}`,
        quotedSpan: "GET /orders",
        source: "heuristic",
        confidence: 0.75,
      },
    ]);
    const source = generateAdapterSource(evilSpec, manifest);
    const docCommentLine = source
      .split("\n")
      .find((line) => line.includes("order.status.read"));
    // The doc-comment line must still be a single comment — the closer
    // can appear (harmless, sanitized to "* /") but never followed by
    // real top-level code on the very next characters within that line.
    expect(docCommentLine).not.toContain("*/ export const pwned");
    expect(docCommentLine).toContain("* / export const pwned");
    expect(docCommentLine?.trim().endsWith("*/")).toBe(true);
  });

  it("marks the file as an unreviewed AI-generated draft", () => {
    const manifest = mapCapabilities("acme", []);
    const source = generateAdapterSource(spec, manifest);
    expect(source).toContain("AI-generated draft");
    expect(source).toContain("NOT reviewed, NOT");
  });
});
