/**
 * ADR-052 Phase 1 — the shared internal shape both parsers (OpenAPI,
 * Postman) converge on. Everything downstream (capability discovery,
 * adapter generation) reads this one type, never the raw source format —
 * so adding a third source format (e.g. a hand-written text extractor,
 * ADR-052 §1's DocumentTextExtractor) never touches consumers, only adds
 * a third producer of this same shape.
 */
export type ParsedSecurityScheme =
  | { kind: "apiKey"; in: "header" | "query"; name: string }
  | { kind: "http"; scheme: "basic" | "bearer" }
  | {
      kind: "oauth2";
      flows: Array<"clientCredentials" | "authorizationCode" | "implicit" | "password">;
    }
  | { kind: "unknown"; raw: string };

export type ParsedEndpoint = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  operationId: string | null;
  summary: string | null;
  description: string | null;
  /** From the source document's own examples only — never invented. */
  requestExample: unknown | null;
  responseExample: unknown | null;
  tags: string[];
};

export type ParsedApiSpec = {
  title: string;
  version: string;
  baseUrl: string | null;
  securitySchemes: ParsedSecurityScheme[];
  endpoints: ParsedEndpoint[];
  sourceFormat: "openapi" | "postman";
};
