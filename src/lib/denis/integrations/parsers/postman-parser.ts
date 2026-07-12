import type {
  ParsedApiSpec,
  ParsedEndpoint,
} from "@/lib/denis/integrations/parsers/parsed-api-spec-types";

const VALID_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export function looksLikePostmanCollection(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  const info = obj.info as Record<string, unknown> | undefined;
  const schema = typeof info?.schema === "string" ? info.schema : "";
  return schema.includes("schema.getpostman.com") || (!!info && Array.isArray(obj.item));
}

function urlToPath(url: unknown): string {
  if (typeof url === "string") {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }
  if (url && typeof url === "object") {
    const u = url as Record<string, unknown>;
    if (Array.isArray(u.path)) {
      return "/" + u.path.filter((p): p is string => typeof p === "string").join("/");
    }
    if (typeof u.raw === "string") {
      try {
        return new URL(u.raw).pathname;
      } catch {
        return u.raw;
      }
    }
  }
  return "/";
}

function parseJsonMaybe(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function parseBodyExample(body: unknown): unknown | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.raw === "string" && b.raw.trim()) {
    return parseJsonMaybe(b.raw);
  }
  return null;
}

/** Postman collections nest requests inside folders ("item" arrays within "item" entries) — recurse to flatten. */
function collectItems(items: unknown, endpoints: ParsedEndpoint[]): void {
  if (!Array.isArray(items)) return;

  for (const entry of items) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;

    if (Array.isArray(item.item)) {
      collectItems(item.item, endpoints);
      continue;
    }

    const request = item.request as Record<string, unknown> | undefined;
    if (!request) continue;

    const method =
      typeof request.method === "string" ? request.method.toUpperCase() : "GET";
    if (!(VALID_METHODS as readonly string[]).includes(method)) continue;

    const responses = Array.isArray(item.response) ? item.response : [];
    const firstResponse = responses[0] as Record<string, unknown> | undefined;
    const responseBody =
      firstResponse && typeof firstResponse.body === "string"
        ? parseJsonMaybe(firstResponse.body)
        : null;

    endpoints.push({
      method: method as ParsedEndpoint["method"],
      path: urlToPath(request.url),
      operationId: typeof item.name === "string" ? item.name : null,
      summary: typeof item.name === "string" ? item.name : null,
      description:
        typeof request.description === "string"
          ? request.description
          : typeof item.description === "string"
            ? item.description
            : null,
      requestExample: parseBodyExample(request.body),
      responseExample: responseBody,
      tags: [],
    });
  }
}

/**
 * Postman Collection v2.1 only. No LLM — same deterministic-first
 * preference as the OpenAPI parser (ADR-052 §1).
 */
export function parsePostmanCollection(raw: unknown): ParsedApiSpec {
  if (!looksLikePostmanCollection(raw)) {
    throw new Error("Not a Postman collection");
  }

  const doc = raw as Record<string, unknown>;
  const info = (doc.info && typeof doc.info === "object" ? doc.info : {}) as Record<
    string,
    unknown
  >;

  const endpoints: ParsedEndpoint[] = [];
  collectItems(doc.item, endpoints);

  // Postman has no OpenAPI-style securitySchemes map — only a best-effort
  // collection-level "auth" block. Never invent a scheme beyond what's here.
  const auth = doc.auth as Record<string, unknown> | undefined;
  const securitySchemes: ParsedApiSpec["securitySchemes"] = [];
  if (auth?.type === "apikey") {
    securitySchemes.push({ kind: "apiKey", in: "header", name: "" });
  } else if (auth?.type === "bearer") {
    securitySchemes.push({ kind: "http", scheme: "bearer" });
  } else if (auth?.type === "basic") {
    securitySchemes.push({ kind: "http", scheme: "basic" });
  } else if (auth?.type === "oauth2") {
    securitySchemes.push({ kind: "oauth2", flows: [] });
  }

  return {
    title: typeof info.name === "string" ? info.name : "Untitled Collection",
    version: "unknown",
    baseUrl: null,
    securitySchemes,
    endpoints,
    sourceFormat: "postman",
  };
}
