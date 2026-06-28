import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

export type ApiRouteCategory =
  | "public"
  | "authenticated"
  | "webhook"
  | "operator"
  | "cron"
  | "jobs"
  | "internal";

export type DiscoveredRoute = {
  filePath: string;
  path: string;
  category: ApiRouteCategory;
  methods: string[];
};

function segmentToOpenApi(segment: string): string {
  if (segment.startsWith("[") && segment.endsWith("]")) {
    const param = segment.slice(1, -1);
    return `{${param}}`;
  }
  return segment;
}

export function filePathToApiPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const match = normalized.match(/src\/app\/api\/(.+)\/route\.ts$/);
  if (!match) return "";
  const segments = match[1].split("/").map(segmentToOpenApi);
  return `/api/${segments.join("/")}`;
}

function categorizeRoute(apiPath: string): ApiRouteCategory {
  if (apiPath.startsWith("/api/cron/")) return "cron";
  if (apiPath.startsWith("/api/jobs/")) return "jobs";
  if (apiPath.startsWith("/api/operator/") || apiPath.startsWith("/api/v1/")) {
    return "operator";
  }
  if (
    apiPath.includes("/webhook") ||
    apiPath === "/api/stripe/webhook" ||
    apiPath.startsWith("/api/pos/")
  ) {
    return "webhook";
  }
  if (
    apiPath.startsWith("/api/dashboard/") ||
    apiPath.startsWith("/api/admin/") ||
    apiPath.startsWith("/api/orders") ||
    apiPath.startsWith("/api/sessions") ||
    apiPath.startsWith("/api/staff-orders") ||
    apiPath.startsWith("/api/export/") ||
    apiPath.startsWith("/api/fiscal/") ||
    apiPath.startsWith("/api/terminal/")
  ) {
    return "authenticated";
  }
  if (
    apiPath.startsWith("/api/ai/") ||
    apiPath.startsWith("/api/denis/") ||
    apiPath.startsWith("/api/guest/") ||
    apiPath.startsWith("/api/commerce/") ||
    apiPath.startsWith("/api/feedback") ||
    apiPath.startsWith("/api/payments/") ||
    apiPath.startsWith("/api/promo/") ||
    apiPath.startsWith("/api/tables/") ||
    apiPath.startsWith("/api/waiter-calls") ||
    apiPath.startsWith("/api/upsell/")
  ) {
    return "public";
  }
  return "internal";
}

function walkApiRoutes(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkApiRoutes(full, acc);
    } else if (entry === "route.ts") {
      acc.push(full);
    }
  }
  return acc;
}

const METHOD_EXPORTS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

function detectMethods(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, "utf8");
    return METHOD_EXPORTS.filter((method) =>
      new RegExp(`export\\s+(const|async function)\\s+${method}\\b`).test(content)
    );
  } catch {
    return ["GET"];
  }
}

/** Discover all App Router API routes under src/app/api. */
export function discoverApiRoutes(root = path.join(process.cwd(), "src/app/api")): DiscoveredRoute[] {
  const files = walkApiRoutes(root);
  return files
    .map((filePath) => {
      const apiPath = filePathToApiPath(filePath);
      return {
        filePath,
        path: apiPath,
        category: categorizeRoute(apiPath),
        methods: detectMethods(filePath),
      };
    })
    .filter((row) => row.path.length > 0)
    .sort((a, b) => a.path.localeCompare(b.path));
}
