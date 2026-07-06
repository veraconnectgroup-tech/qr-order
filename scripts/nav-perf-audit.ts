/**
 * Staff/public navigation timing audit.
 * Usage: BASE_URL=http://localhost:3000 pnpm tsx scripts/nav-perf-audit.ts
 *
 * Optional auth (for authenticated staff nav):
 *   PERF_STAFF_EMAIL=... PERF_STAFF_PASSWORD=...
 */
import { chromium, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const STAFF_EMAIL = process.env.PERF_STAFF_EMAIL;
const STAFF_PASSWORD = process.env.PERF_STAFF_PASSWORD;
const RUNS = Number(process.env.PERF_RUNS ?? "3");

type NavSample = {
  label: string;
  path: string;
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  visibleMs: number;
  httpStatus: number;
  finalUrl: string;
};

type ClickSample = {
  from: string;
  to: string;
  clickToPaintMs: number;
  clickToNetworkIdleMs: number;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

async function measureGoto(
  page: Page,
  path: string,
  label: string,
  waitSelector?: string
): Promise<NavSample> {
  await page.goto("about:blank");
  const started = Date.now();

  const response = await page.goto(`${BASE_URL}${path}`, {
    waitUntil: "domcontentloaded",
  });

  const navTiming = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (!nav) {
      return { ttfbMs: 0, domContentLoadedMs: 0, loadMs: 0 };
    }
    return {
      ttfbMs: nav.responseStart - nav.startTime,
      domContentLoadedMs: nav.domContentLoadedEventEnd - nav.startTime,
      loadMs: nav.loadEventEnd - nav.startTime,
    };
  });

  if (waitSelector) {
    await page.waitForSelector(waitSelector, { timeout: 30_000 });
  }

  const visibleMs = Date.now() - started;

  return {
    label,
    path,
    ttfbMs: Math.round(navTiming.ttfbMs),
    domContentLoadedMs: Math.round(navTiming.domContentLoadedMs),
    loadMs: Math.round(navTiming.loadMs),
    visibleMs,
    httpStatus: response?.status() ?? 0,
    finalUrl: page.url(),
  };
}

async function measureClickNav(
  page: Page,
  linkName: string,
  fromPath: string,
  toPathFragment: string
): Promise<ClickSample | null> {
  await page.goto(`${BASE_URL}${fromPath}`, { waitUntil: "domcontentloaded" });
  const link = page.getByRole("link", { name: linkName }).first();
  if (!(await link.isVisible({ timeout: 5000 }).catch(() => false))) {
    return null;
  }

  const started = Date.now();
  await link.click();
  await page.waitForURL(new RegExp(toPathFragment.replace(/\//g, "\\/")), {
    timeout: 30_000,
  });
  const clickToPaintMs = Date.now() - started;

  const idleStarted = Date.now();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  const clickToNetworkIdleMs = Date.now() - idleStarted + clickToPaintMs;

  return {
    from: fromPath,
    to: page.url(),
    clickToPaintMs,
    clickToNetworkIdleMs,
  };
}

async function tryStaffLogin(page: Page): Promise<boolean> {
  if (!STAFF_EMAIL || !STAFF_PASSWORD) return false;

  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).fill(STAFF_EMAIL);
  await page.getByLabel(/password/i).fill(STAFF_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/(dashboard|admin|waiter|bar|kitchen)/, {
    timeout: 30_000,
  });
  return true;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const publicRoutes: Array<{
    path: string;
    label: string;
    waitSelector?: string;
  }> = [
    { path: "/", label: "Landing", waitSelector: "h1" },
    { path: "/login", label: "Login", waitSelector: "input[type='email'], input[name='email']" },
    { path: "/signup", label: "Signup", waitSelector: "h1" },
  ];

  console.log(`\n=== NAV PERF AUDIT ===`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Runs per route: ${RUNS}\n`);

  console.log("## Server navigation (page.goto → selector visible)\n");
  console.log("| Route | median TTFB | median DCL | median visible | status | final URL |");
  console.log("|-------|-------------|------------|----------------|--------|-----------|");

  for (const route of publicRoutes) {
    const samples: NavSample[] = [];
    for (let i = 0; i < RUNS; i++) {
      samples.push(
        await measureGoto(page, route.path, route.label, route.waitSelector)
      );
    }
    const med = {
      ttfb: median(samples.map((s) => s.ttfbMs)),
      dcl: median(samples.map((s) => s.domContentLoadedMs)),
      visible: median(samples.map((s) => s.visibleMs)),
    };
    const last = samples[samples.length - 1]!;
    console.log(
      `| ${route.label} | ${med.ttfb}ms | ${med.dcl}ms | ${med.visible}ms | ${last.httpStatus} | ${last.finalUrl.replace(BASE_URL, "")} |`
    );
  }

  console.log("\n## Protected routes (unauthenticated redirect)\n");
  const protectedRoutes = [
    "/dashboard",
    "/dashboard/orders",
    "/dashboard/tables",
    "/dashboard/kitchen",
    "/admin",
    "/bar",
    "/waiter",
    "/kitchen",
  ];

  console.log("| Route | median TTFB | median visible | redirects to |");
  console.log("|-------|-------------|----------------|--------------|");

  for (const path of protectedRoutes) {
    const samples: NavSample[] = [];
    for (let i = 0; i < RUNS; i++) {
      samples.push(await measureGoto(page, path, path));
    }
    const last = samples[samples.length - 1]!;
    console.log(
      `| ${path} | ${median(samples.map((s) => s.ttfbMs))}ms | ${median(samples.map((s) => s.visibleMs))}ms | ${last.finalUrl.replace(BASE_URL, "")} |`
    );
  }

  const loggedIn = await tryStaffLogin(page);
  console.log(
    `\n## Staff sidebar clicks ${loggedIn ? "(authenticated)" : "(skipped — set PERF_STAFF_EMAIL/PERF_STAFF_PASSWORD)"}\n`
  );

  if (loggedIn) {
    const clicks: Array<{ name: string; from: string; to: string }> = [
      { name: "Orders", from: "/dashboard", to: "/dashboard/orders" },
      { name: "Tables", from: "/dashboard", to: "/dashboard/tables" },
      { name: "Prep Display", from: "/dashboard", to: "/dashboard/kitchen" },
      { name: "Overview", from: "/dashboard/orders", to: "/dashboard" },
    ];

    console.log("| Click | median paint | median network idle |");
    console.log("|-------|--------------|-------------------|");

    for (const click of clicks) {
      const samples: ClickSample[] = [];
      for (let i = 0; i < RUNS; i++) {
        const sample = await measureClickNav(
          page,
          click.name,
          click.from,
          click.to
        );
        if (sample) samples.push(sample);
      }
      if (samples.length === 0) {
        console.log(`| ${click.name} | n/a | n/a |`);
        continue;
      }
      console.log(
        `| ${click.from} → ${click.name} | ${median(samples.map((s) => s.clickToPaintMs))}ms | ${median(samples.map((s) => s.clickToNetworkIdleMs))}ms |`
      );
    }
  }

  await browser.close();
  console.log("\nDone. Re-run on production build: pnpm build && pnpm start\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
