import type { ParsedApiSpec } from "@/lib/denis/integrations/parsers/parsed-api-spec-types";
import type {
  CapabilityManifest,
  CapabilityRecord,
} from "@/lib/denis/integrations/capabilities/denis-capability-types";
import { resolveAdapterMethodName } from "@/lib/denis/integrations/capabilities/denis-capability-types";

/**
 * ADR-052 §F — deterministic, template-based TypeScript codegen. Only
 * ever generates a method for a capability the caller has already had
 * confirmed by a human (manifest passed in must already be the
 * human-approved subset, per ADR-052 §C step 6) — this function does not
 * itself decide which capabilities to build, it renders code for exactly
 * what it's given. Output is a plain string; the caller decides where it
 * lands (draft DB row, generated/ workspace folder) — this module never
 * writes to disk.
 */

function toPascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

function findEndpoint(
  spec: ParsedApiSpec,
  endpointLabel: string | null
): { method: string; path: string } | null {
  if (!endpointLabel) return null;
  const [method, ...pathParts] = endpointLabel.split(" ");
  const path = pathParts.join(" ");
  const match = spec.endpoints.find(
    (e) => e.method === method && e.path === path
  );
  return match ? { method: match.method, path: match.path } : null;
}

function renderAuthHeadersMethod(spec: ParsedApiSpec): string {
  const scheme = spec.securitySchemes[0];

  if (!scheme || scheme.kind === "unknown") {
    return [
      "  private authHeaders(config: Record<string, unknown>): Record<string, string> {",
      "    // TODO: source document did not describe a recognized auth scheme —",
      "    // wire this manually before this adapter can make a real call.",
      "    void config;",
      "    return {};",
      "  }",
    ].join("\n");
  }

  if (scheme.kind === "apiKey" && scheme.in === "header") {
    return [
      "  private authHeaders(config: Record<string, unknown>): Record<string, string> {",
      `    const apiKey = typeof config.apiKey === "string" ? config.apiKey : "";`,
      `    return { ${JSON.stringify(scheme.name || "X-Api-Key")}: apiKey };`,
      "  }",
    ].join("\n");
  }

  if (scheme.kind === "apiKey" && scheme.in === "query") {
    return [
      "  private authHeaders(config: Record<string, unknown>): Record<string, string> {",
      "    // API key belongs in the query string for this provider — appended in each call, not here.",
      "    void config;",
      "    return {};",
      "  }",
    ].join("\n");
  }

  if (scheme.kind === "http" && scheme.scheme === "bearer") {
    return [
      "  private authHeaders(config: Record<string, unknown>): Record<string, string> {",
      `    const token = typeof config.accessToken === "string" ? config.accessToken : "";`,
      '    return { Authorization: `Bearer ${token}` };',
      "  }",
    ].join("\n");
  }

  if (scheme.kind === "http" && scheme.scheme === "basic") {
    return [
      "  private authHeaders(config: Record<string, unknown>): Record<string, string> {",
      `    const username = typeof config.username === "string" ? config.username : "";`,
      `    const password = typeof config.password === "string" ? config.password : "";`,
      "    return { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString(\"base64\")}` };",
      "  }",
    ].join("\n");
  }

  return [
    "  private authHeaders(config: Record<string, unknown>): Record<string, string> {",
    "    // TODO: OAuth2 flow requires human setup (token exchange) before this adapter can call anything.",
    "    void config;",
    "    return {};",
    "  }",
  ].join("\n");
}

function renderMethod(
  record: CapabilityRecord,
  endpoint: { method: string; path: string }
): string {
  const methodName = resolveAdapterMethodName(record.capability);
  const hasBody = ["POST", "PUT", "PATCH"].includes(endpoint.method);

  return [
    `  /** ${record.capability} — ${endpoint.method} ${endpoint.path}. Source: ${JSON.stringify(record.quotedSpan)}. */`,
    `  async ${methodName}(input: Record<string, unknown>, config: Record<string, unknown>): Promise<Result<unknown>> {`,
    `    const response = await fetch(\`\${this.baseUrl}${endpoint.path.replace(/\{[^}]+\}/g, (m) => `\${input.${m.slice(1, -1)}}`)}\`, {`,
    `      method: ${JSON.stringify(endpoint.method)},`,
    `      headers: { "Content-Type": "application/json", ...this.authHeaders(config) },`,
    hasBody ? "      body: JSON.stringify(input)," : "",
    "      signal: AbortSignal.timeout(10_000),",
    "    });",
    "    if (!response.ok) {",
    "      return { ok: false, error: `HTTP ${response.status}` };",
    "    }",
    "    const data = await response.json();",
    "    return { ok: true, data };",
    "  }",
  ]
    .filter(Boolean)
    .join("\n");
}

export function generateAdapterSource(
  spec: ParsedApiSpec,
  manifest: CapabilityManifest
): string {
  const className = `${toPascalCase(manifest.provider)}Adapter`;
  const supportedRecords = manifest.records.filter(
    (r) => r.status === "supported"
  );

  const methods = supportedRecords
    .map((record) => {
      const endpoint = findEndpoint(spec, record.endpoint);
      return endpoint ? renderMethod(record, endpoint) : null;
    })
    .filter((m): m is string => m !== null);

  return [
    "/**",
    ` * AI-generated draft — ADR-052 Integration Builder. NOT reviewed, NOT`,
    ` * activated. A human must review this diff and approve it (ADR-052`,
    ` * §C steps 13-14) before it becomes a real adapter under`,
    ` * src/lib/pos/adapters/. Every method below only exists because a`,
    ` * human already confirmed its capability in the review step — this`,
    ` * file does not decide what to generate, only how.`,
    " */",
    "type Result<T> = { ok: true; data: T } | { ok: false; error: string };",
    "",
    `export class ${className} {`,
    `  provider = ${JSON.stringify(manifest.provider)};`,
    `  private baseUrl = ${JSON.stringify(spec.baseUrl ?? "")};`,
    "",
    renderAuthHeadersMethod(spec),
    ...(methods.length > 0 ? ["", methods.join("\n\n")] : []),
    "}",
    "",
  ].join("\n");
}
