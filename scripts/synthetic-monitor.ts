/**
 * Synthetic monitoring — run every 5 min via external cron (Checkly, UptimeRobot, etc.)
 *
 * Usage: pnpm monitor:synthetic
 * Env: MONITOR_BASE_URL (default http://localhost:3000)
 */
type HealthCheck = {
  name: string;
  pass: boolean;
  latencyMs: number;
  detail?: string;
};

type HealthCheckResult = {
  allPassing: boolean;
  checks: HealthCheck[];
  timestamp: string;
};

async function checkEndpoint(
  baseUrl: string,
  method: "GET" | "POST",
  path: string,
  options?: { expectStatus?: number; body?: unknown; headers?: Record<string, string> }
): Promise<HealthCheck> {
  const started = Date.now();
  const name = `${method} ${path}`;
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    const expect = options?.expectStatus ?? 200;
    const pass = res.status === expect || (expect === 200 && res.status < 500);
    return {
      name,
      pass,
      latencyMs: Date.now() - started,
      detail: pass ? undefined : `status ${res.status}, expected ${expect}`,
    };
  } catch (err) {
    return {
      name,
      pass: false,
      latencyMs: Date.now() - started,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function syntheticCheck(baseUrl: string): Promise<HealthCheckResult> {
  const checks = await Promise.all([
    checkEndpoint(baseUrl, "GET", "/api/health/deep", { expectStatus: 200 }),
    checkEndpoint(baseUrl, "GET", "/skyline-lounge/demo-table-8", { expectStatus: 200 }),
    checkEndpoint(baseUrl, "GET", "/api/ai/status", { expectStatus: 200 }),
    checkEndpoint(baseUrl, "GET", "/status", { expectStatus: 200 }),
  ]);

  return {
    allPassing: checks.every((c) => c.pass),
    checks,
    timestamp: new Date().toISOString(),
  };
}

async function main() {
  const baseUrl = process.env.MONITOR_BASE_URL ?? "http://localhost:3000";
  const result = await syntheticCheck(baseUrl);

  console.log(`=== SYNTHETIC MONITOR @ ${result.timestamp} ===\n`);
  for (const check of result.checks) {
    const icon = check.pass ? "🟢" : "🔴";
    console.log(`${icon} ${check.name} — ${check.latencyMs}ms${check.detail ? ` (${check.detail})` : ""}`);
  }

  if (!result.allPassing) {
    console.error("\n⚠️ Synthetic check failed — alert after 2 consecutive failures");
    process.exit(1);
  }
  console.log("\n✅ All checks passing");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
