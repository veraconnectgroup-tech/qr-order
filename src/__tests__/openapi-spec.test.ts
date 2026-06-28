import { describe, expect, it } from "vitest";
import { discoverApiRoutes } from "@/lib/api-docs/discover-routes";
import { buildOpenApiSpec } from "@/lib/api-docs/openapi-spec";

describe("OpenAPI spec (AL1)", () => {
  it("includes every discovered API route", () => {
    const routes = discoverApiRoutes();
    const spec = buildOpenApiSpec();
    expect(routes.length).toBeGreaterThanOrEqual(100);

    for (const route of routes) {
      expect(spec.paths[route.path], `missing path ${route.path}`).toBeDefined();
    }
  });

  it("validates core guest and webhook paths are documented with schemas", () => {
    const spec = buildOpenApiSpec();
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/api/ai/chat"]?.post).toBeDefined();
    expect(spec.paths["/api/denis/sense"]?.post).toBeDefined();
    expect(spec.paths["/api/stripe/webhook"]?.post).toBeDefined();
    expect(spec.components?.schemas).toBeDefined();
  });
});
