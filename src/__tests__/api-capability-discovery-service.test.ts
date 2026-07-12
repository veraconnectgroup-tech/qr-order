import { afterEach, describe, expect, it, vi } from "vitest";
import type { ParsedApiSpec } from "@/lib/denis/integrations/parsers/parsed-api-spec-types";

describe("discoverApiCapabilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("uses the heuristic match without calling the LLM when structure is unambiguous", async () => {
    const discoverEndpointCapability = vi.fn();
    vi.doMock("@/lib/denis/cognition/perceive/discover-endpoint-capability", () => ({
      discoverEndpointCapability,
    }));
    const { discoverApiCapabilities } = await import(
      "@/lib/denis/integrations/discovery/api-capability-discovery-service"
    );

    const spec: ParsedApiSpec = {
      title: "Acme",
      version: "1.0",
      baseUrl: null,
      securitySchemes: [],
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

    const proposals = await discoverApiCapabilities(spec);

    expect(proposals).toHaveLength(1);
    expect(proposals[0].capability).toBe("order.create");
    expect(proposals[0].source).toBe("heuristic");
    expect(discoverEndpointCapability).not.toHaveBeenCalled();
  });

  it("falls back to the LLM classifier for an endpoint the heuristic can't resolve", async () => {
    const discoverEndpointCapability = vi.fn().mockResolvedValue({
      capability: "reservation.create",
      confidence: 0.7,
      quotedSpan: "Book a new reservation slot",
    });
    vi.doMock("@/lib/denis/cognition/perceive/discover-endpoint-capability", () => ({
      discoverEndpointCapability,
    }));
    const { discoverApiCapabilities } = await import(
      "@/lib/denis/integrations/discovery/api-capability-discovery-service"
    );

    const spec: ParsedApiSpec = {
      title: "Acme",
      version: "1.0",
      baseUrl: null,
      securitySchemes: [],
      endpoints: [
        {
          method: "POST",
          path: "/slots",
          operationId: "bookSlot",
          summary: "Book a new reservation slot",
          description: null,
          requestExample: null,
          responseExample: null,
          tags: [],
        },
      ],
      sourceFormat: "openapi",
    };

    const proposals = await discoverApiCapabilities(spec);

    expect(discoverEndpointCapability).toHaveBeenCalledTimes(1);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].capability).toBe("reservation.create");
    expect(proposals[0].source).toBe("llm");
  });

  it("produces no proposal when the LLM fallback also returns 'none'", async () => {
    const discoverEndpointCapability = vi.fn().mockResolvedValue({
      capability: "none",
      confidence: 0.9,
      quotedSpan: "Rotate API credentials",
    });
    vi.doMock("@/lib/denis/cognition/perceive/discover-endpoint-capability", () => ({
      discoverEndpointCapability,
    }));
    const { discoverApiCapabilities } = await import(
      "@/lib/denis/integrations/discovery/api-capability-discovery-service"
    );

    const spec: ParsedApiSpec = {
      title: "Acme",
      version: "1.0",
      baseUrl: null,
      securitySchemes: [],
      endpoints: [
        {
          method: "POST",
          path: "/credentials/rotate",
          operationId: null,
          summary: "Rotate API credentials",
          description: null,
          requestExample: null,
          responseExample: null,
          tags: [],
        },
      ],
      sourceFormat: "openapi",
    };

    const proposals = await discoverApiCapabilities(spec);

    expect(proposals).toHaveLength(0);
  });
});
