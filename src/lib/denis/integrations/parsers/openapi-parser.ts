import type {
  ParsedApiSpec,
  ParsedEndpoint,
  ParsedSecurityScheme,
} from "@/lib/denis/integrations/parsers/parsed-api-spec-types";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;
const OAUTH2_FLOWS = [
  "clientCredentials",
  "authorizationCode",
  "implicit",
  "password",
] as const;

export function looksLikeOpenApiSpec(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  return typeof obj.openapi === "string" || typeof obj.swagger === "string";
}

function parseSecuritySchemes(raw: unknown): ParsedSecurityScheme[] {
  if (!raw || typeof raw !== "object") return [];
  const schemes: ParsedSecurityScheme[] = [];

  for (const value of Object.values(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const scheme = value as Record<string, unknown>;
    const type = typeof scheme.type === "string" ? scheme.type : "";

    if (type === "apiKey") {
      schemes.push({
        kind: "apiKey",
        in: scheme.in === "query" ? "query" : "header",
        name: typeof scheme.name === "string" ? scheme.name : "",
      });
    } else if (type === "http") {
      schemes.push({
        kind: "http",
        scheme: scheme.scheme === "basic" ? "basic" : "bearer",
      });
    } else if (type === "oauth2") {
      const flowKeys =
        scheme.flows && typeof scheme.flows === "object"
          ? Object.keys(scheme.flows as Record<string, unknown>)
          : [];
      schemes.push({
        kind: "oauth2",
        flows: flowKeys.filter((f): f is (typeof OAUTH2_FLOWS)[number] =>
          (OAUTH2_FLOWS as readonly string[]).includes(f)
        ),
      });
    } else {
      schemes.push({ kind: "unknown", raw: type || "unspecified" });
    }
  }

  return schemes;
}

/** Only ever reads an example the document itself provides — never invents one. */
function extractExample(schemaOrContent: unknown): unknown | null {
  if (!schemaOrContent || typeof schemaOrContent !== "object") return null;
  const obj = schemaOrContent as Record<string, unknown>;
  const content =
    obj.content && typeof obj.content === "object"
      ? (obj.content as Record<string, unknown>)
      : null;
  const json = content?.["application/json"] as Record<string, unknown> | undefined;

  if (json?.example !== undefined) return json.example;

  if (json?.examples && typeof json.examples === "object") {
    const first = Object.values(json.examples as Record<string, unknown>)[0];
    if (
      first &&
      typeof first === "object" &&
      "value" in (first as Record<string, unknown>)
    ) {
      return (first as Record<string, unknown>).value;
    }
  }

  if (json?.schema && typeof json.schema === "object") {
    const schema = json.schema as Record<string, unknown>;
    if (schema.example !== undefined) return schema.example;
  }

  return null;
}

/**
 * OpenAPI 3.x / Swagger 2.x JSON only (no YAML — that would need a new
 * dependency; convert YAML to JSON before calling this). Deterministic,
 * no LLM — the whole point of preferring OpenAPI/Postman as inputs
 * (ADR-052 §1) is that structure parsing doesn't need one.
 */
export function parseOpenApiSpec(raw: unknown): ParsedApiSpec {
  if (!looksLikeOpenApiSpec(raw)) {
    throw new Error("Not an OpenAPI/Swagger document");
  }

  const doc = raw as Record<string, unknown>;
  const info = (doc.info && typeof doc.info === "object" ? doc.info : {}) as Record<
    string,
    unknown
  >;
  const servers = Array.isArray(doc.servers) ? doc.servers : [];
  const firstServer = servers[0] as Record<string, unknown> | undefined;

  const components = (doc.components && typeof doc.components === "object"
    ? doc.components
    : {}) as Record<string, unknown>;
  // Swagger 2.0 declares security schemes at the document root, not under components.
  const securitySchemesRaw = components.securitySchemes ?? doc.securityDefinitions;

  const paths = (doc.paths && typeof doc.paths === "object" ? doc.paths : {}) as Record<
    string,
    unknown
  >;
  const endpoints: ParsedEndpoint[] = [];

  for (const [path, pathItemRaw] of Object.entries(paths)) {
    if (!pathItemRaw || typeof pathItemRaw !== "object") continue;
    const pathItem = pathItemRaw as Record<string, unknown>;

    for (const method of HTTP_METHODS) {
      const opRaw = pathItem[method];
      if (!opRaw || typeof opRaw !== "object") continue;
      const op = opRaw as Record<string, unknown>;

      const responses = (op.responses && typeof op.responses === "object"
        ? op.responses
        : {}) as Record<string, unknown>;
      const successResponse =
        responses["200"] ?? responses["201"] ?? Object.values(responses)[0];

      endpoints.push({
        method: method.toUpperCase() as ParsedEndpoint["method"],
        path,
        operationId: typeof op.operationId === "string" ? op.operationId : null,
        summary: typeof op.summary === "string" ? op.summary : null,
        description: typeof op.description === "string" ? op.description : null,
        requestExample: extractExample(op.requestBody),
        responseExample: extractExample(successResponse),
        tags: Array.isArray(op.tags)
          ? op.tags.filter((t): t is string => typeof t === "string")
          : [],
      });
    }
  }

  return {
    title: typeof info.title === "string" ? info.title : "Untitled API",
    version: typeof info.version === "string" ? info.version : "unknown",
    baseUrl: typeof firstServer?.url === "string" ? firstServer.url : null,
    securitySchemes: parseSecuritySchemes(securitySchemesRaw),
    endpoints,
    sourceFormat: "openapi",
  };
}
