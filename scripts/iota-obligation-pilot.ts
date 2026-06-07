/**
 * ADR-033 P0 — live iota obligation pilot harness (5 QR scenarios).
 *
 * Rule: `pnpm eval:denis` PASS ≠ ADR COMPLETE until this harness PASS on a fresh session.
 *
 * Usage: pnpm pilot:iota
 *
 * Env: NEXT_PUBLIC_APP_URL (or IOTA_URL), NEXT_PUBLIC_SUPABASE_URL,
 *      SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET (scenario 5).
 * Loads .env files, then falls back to linked `supabase` CLI project keys.
 */
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TABLE_TOKEN = process.env.IOTA_TABLE_TOKEN ?? "demo-table-1";
const SIGNAL_SLA_MS = 15_000;
const SKYLINE_PILOT_LOCATION_ID =
  "b0000000-0000-4000-8000-000000000001";

type SignalResult = {
  ok: boolean;
  status: number;
  elapsedMs: number;
  body: Record<string, unknown>;
  error?: string;
};

type ViewSnapshot = Record<string, unknown> | null;

type ScenarioResult = { id: string; ok: boolean; detail: string };

function loadEnvFiles() {
  for (const file of [".env.vercel.local", ".env.local"]) {
    try {
      const raw = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq);
        let val = trimmed.slice(eq + 1);
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (val.trim().length > 0) {
          process.env[key] = val;
        }
      }
    } catch {
      // optional file
    }
  }
}

function bootstrapFromSupabaseCli(): boolean {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  if (hasUrl && hasKey) return false;

  let projectRef = "";
  try {
    projectRef = readFileSync(
      resolve(process.cwd(), "supabase/.temp/project-ref"),
      "utf8"
    ).trim();
  } catch {
    return false;
  }
  if (!projectRef) return false;

  try {
    const raw = execSync(
      `supabase projects api-keys --project-ref ${projectRef} -o json`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    const keys = JSON.parse(raw) as Array<{ name?: string; api_key?: string }>;
    const serviceKey = keys.find((row) => row.name === "service_role")?.api_key;

    if (!hasUrl) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${projectRef}.supabase.co`;
    }
    if (!hasKey && serviceKey) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
    }

    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    );
  } catch {
    return false;
  }
}

/** Must run before dynamic @/ imports (createAdminClient reads env.ts at load time). */
loadEnvFiles();
const bootstrappedFromCli = bootstrapFromSupabaseCli();

function randomSignalId(): string {
  return `pilot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function unwrapSignalData(json: Record<string, unknown>): Record<string, unknown> {
  const data = json.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return json;
}

async function postSignal(
  baseUrl: string,
  input: {
    text: string;
    tableToken: string;
    sessionToken: string;
    locationId: string;
    tableId: string;
    structuredIntent?: string;
  }
): Promise<SignalResult> {
  const started = Date.now();
  const signalId = randomSignalId();
  const res = await fetch(`${baseUrl}/api/denis/signal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "message",
      text: input.text,
      tableToken: input.tableToken,
      sessionToken: input.sessionToken,
      locationId: input.locationId,
      tableId: input.tableId,
      signalId,
      language: "sr",
      allowOrdering: true,
      structuredIntent: input.structuredIntent,
    }),
  });

  const elapsedMs = Date.now() - started;
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
  };
  const body = unwrapSignalData(json);

  if (res.status === 504 || json.error === "signal_timeout") {
    return {
      ok: false,
      status: res.status,
      elapsedMs,
      body,
      error: "signal_timeout",
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      elapsedMs,
      body,
      error: typeof json.error === "string" ? json.error : `http_${res.status}`,
    };
  }

  return { ok: true, status: res.status, elapsedMs, body };
}

async function fetchView(
  baseUrl: string,
  tableToken: string,
  sessionToken: string
): Promise<ViewSnapshot> {
  const params = new URLSearchParams({ tableToken, sessionToken });
  const res = await fetch(`${baseUrl}/api/denis/view?${params}`, {
    cache: "no-store",
  });
  const json = (await res.json()) as { data?: { view?: Record<string, unknown> } };
  return json.data?.view ?? null;
}

function viewTranscriptTexts(view: ViewSnapshot): string[] {
  const transcript = view?.transcript;
  if (!Array.isArray(transcript)) return [];
  return transcript.map((line) =>
    String((line as { text?: string }).text ?? "").toLowerCase()
  );
}

function viewHasWaiterGapLayer(view: ViewSnapshot): boolean {
  const layers = view?.layers;
  if (!Array.isArray(layers)) return false;
  return layers.some((layer) => {
    const row = layer as { kind?: string; id?: string; message?: string };
    return (
      row.kind === "banner" &&
      (String(row.id ?? "").includes("waiter-gap") ||
        String(row.message ?? "").toLowerCase().includes("pivo"))
    );
  });
}

function signalDetail(signal: SignalResult): string {
  if (signal.error) return `${signal.error} (${signal.elapsedMs}ms)`;
  const msg = String(signal.body.message ?? "").slice(0, 80);
  return `submit=${Boolean(signal.body.submitOrder || signal.body.orderSubmit)} msg=${msg} (${signal.elapsedMs}ms)`;
}

function assertScenario(
  id: string,
  ok: boolean,
  detail: string,
  results: ScenarioResult[]
) {
  results.push({ id, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${id}: ${detail}`);
}

async function ensureFreshSession(
  admin: SupabaseClient,
  tableId: string,
  locationId: string,
  sessionApi: {
    closeTableSession: (
      admin: SupabaseClient,
      sessionId: string,
      reason: "void"
    ) => Promise<void>;
    findOrCreateTableSession: (
      admin: SupabaseClient,
      tableId: string,
      locationId: string
    ) => Promise<
      | { sessionId: string; sessionToken: string }
      | { error: string; status: number }
    >;
  }
) {
  const { data: active } = await admin
    .from("table_sessions")
    .select("id")
    .eq("table_id", tableId)
    .eq("status", "active");

  for (const row of active ?? []) {
    await sessionApi.closeTableSession(
      admin,
      (row as { id: string }).id,
      "void"
    );
  }

  const created = await sessionApi.findOrCreateTableSession(
    admin,
    tableId,
    locationId
  );
  if ("error" in created) {
    throw new Error(created.error);
  }
  return created;
}

async function main() {
  const baseUrl =
    process.env.IOTA_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://qr-order-iota.vercel.app";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url?.trim() || !serviceKey?.trim()) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
    console.error("Fix one of:");
    console.error("  1. Add keys to .env.local (Supabase → Project Settings → API)");
    console.error("  2. vercel env pull .env.vercel.local");
    console.error("  3. supabase link --project-ref <ref>  (CLI auto-bootstrap)");
    process.exit(1);
  }

  if (bootstrappedFromCli) {
    console.log(
      "Supabase env bootstrapped from linked CLI project (supabase/.temp/project-ref).\n"
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ findOrCreateTableSession }, { closeTableSession }] =
    await Promise.all([
      import("@/lib/sessions/find-or-create-table-session"),
      import("@/lib/sessions/session-devices"),
    ]);
  const sessionApi = { findOrCreateTableSession, closeTableSession };

  console.log("=== iota obligation pilot (ADR-033 P0) ===");
  console.log(`URL: ${baseUrl}`);
  console.log(`Table: ${TABLE_TOKEN}`);
  console.log(`Signal SLA: template turns <${SIGNAL_SLA_MS}ms\n`);

  const { data: table } = await admin
    .from("tables")
    .select("id, location_id")
    .eq("qr_token", TABLE_TOKEN)
    .eq("is_active", true)
    .maybeSingle();

  if (!table) {
    console.error(`Table not found: ${TABLE_TOKEN}`);
    process.exit(1);
  }

  const tableRow = table as { id: string; location_id: string };
  const locationId = tableRow.location_id || SKYLINE_PILOT_LOCATION_ID;

  const session = await ensureFreshSession(
    admin,
    tableRow.id,
    locationId,
    sessionApi
  );
  console.log(`Fresh session: ${session.sessionToken.slice(0, 8)}…\n`);

  const results: ScenarioResult[] = [];

  // 1 — burger+pivo gap → drink clarify (template, <15s)
  const s1 = await postSignal(baseUrl, {
    text: "moze jedno pivo i beef burger",
    tableToken: TABLE_TOKEN,
    sessionToken: session.sessionToken,
    locationId,
    tableId: tableRow.id,
  });
  const view1 = await fetchView(baseUrl, TABLE_TOKEN, session.sessionToken);
  const msg1 = String(s1.body.message ?? "").toLowerCase();
  const transcript1 = viewTranscriptTexts(view1);
  assertScenario(
    "1_gap_drink_clarify",
    s1.ok &&
      s1.elapsedMs < SIGNAL_SLA_MS &&
      !s1.body.submitOrder &&
      !s1.body.orderSubmit &&
      (msg1.includes("pivo") || msg1.includes("pilsner") || msg1.includes("weizen")) &&
      (viewHasWaiterGapLayer(view1) ||
        transcript1.some((t) => t.includes("pivo") || t.includes("pilsner"))),
    `${signalDetail(s1)} viewGap=${viewHasWaiterGapLayer(view1)}`,
    results
  );

  // 2 — confirm blocked with open gap
  const s2 = await postSignal(baseUrl, {
    text: "da",
    tableToken: TABLE_TOKEN,
    sessionToken: session.sessionToken,
    locationId,
    tableId: tableRow.id,
    structuredIntent: "CONFIRM",
  });
  const view2 = await fetchView(baseUrl, TABLE_TOKEN, session.sessionToken);
  assertScenario(
    "2_gap_blocks_confirm",
    s2.ok &&
      s2.elapsedMs < SIGNAL_SLA_MS &&
      !s2.body.submitOrder &&
      !s2.body.orderSubmit &&
      viewHasWaiterGapLayer(view2),
    `${signalDetail(s2)} viewGap=${viewHasWaiterGapLayer(view2)}`,
    results
  );

  // 3 — Pilsner clears gap + confirm submit
  const s3a = await postSignal(baseUrl, {
    text: "pilsner",
    tableToken: TABLE_TOKEN,
    sessionToken: session.sessionToken,
    locationId,
    tableId: tableRow.id,
  });
  const s3b = await postSignal(baseUrl, {
    text: "da",
    tableToken: TABLE_TOKEN,
    sessionToken: session.sessionToken,
    locationId,
    tableId: tableRow.id,
    structuredIntent: "CONFIRM",
  });
  const view3 = await fetchView(baseUrl, TABLE_TOKEN, session.sessionToken);
  const submitted = Boolean(s3b.body.submitOrder || s3b.body.orderSubmit);
  assertScenario(
    "3_gap_cleared_submit",
    s3a.ok &&
      s3b.ok &&
      s3b.elapsedMs < SIGNAL_SLA_MS &&
      submitted &&
      !viewHasWaiterGapLayer(view3),
    `pilsner=${s3a.ok} submit=${submitted} viewGap=${viewHasWaiterGapLayer(view3)} (${s3b.elapsedMs}ms)`,
    results
  );

  // 4 — substitution gap (fresh session)
  const subSession = await ensureFreshSession(
    admin,
    tableRow.id,
    locationId,
    sessionApi
  );
  const s4 = await postSignal(baseUrl, {
    text: "beef burger sa salatom umesto pomfrita",
    tableToken: TABLE_TOKEN,
    sessionToken: subSession.sessionToken,
    locationId,
    tableId: tableRow.id,
  });
  const view4 = await fetchView(baseUrl, TABLE_TOKEN, subSession.sessionToken);
  const msg4 = String(s4.body.message ?? "").toLowerCase();
  assertScenario(
    "4_substitution_gap",
    s4.ok &&
      !s4.body.submitOrder &&
      !s4.body.orderSubmit &&
      (msg4.includes("zamena") ||
        msg4.includes("salat") ||
        msg4.includes("kuhinj") ||
        msg4.includes("napomen") ||
        viewHasWaiterGapLayer(view4)),
    `submit=false msg=${msg4.slice(0, 80)} viewGap=${viewHasWaiterGapLayer(view4)}`,
    results
  );

  // 5 — autonomous waiter_gap via session watcher cron
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    assertScenario(
      "5_autonomous_waiter_gap",
      false,
      "CRON_SECRET missing — cannot assert watcher cron",
      results
    );
  } else {
    const gapSession = await ensureFreshSession(
      admin,
      tableRow.id,
      locationId,
      sessionApi
    );
    await postSignal(baseUrl, {
      text: "moze jedno pivo i beef burger",
      tableToken: TABLE_TOKEN,
      sessionToken: gapSession.sessionToken,
      locationId,
      tableId: tableRow.id,
    });

    const cronRes = await fetch(`${baseUrl}/api/cron/denis-session-watcher`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const cronJson = (await cronRes.json().catch(() => ({}))) as {
      data?: { guestNudges?: number; scanned?: number };
    };

    const view5 = await fetchView(baseUrl, TABLE_TOKEN, gapSession.sessionToken);
    const transcript5 = viewTranscriptTexts(view5);
    const hasGapTell = transcript5.some(
      (t) => t.includes("pivo") || t.includes("pilsner") || t.includes("weizen")
    );
    const nudges = cronJson.data?.guestNudges ?? 0;

    assertScenario(
      "5_autonomous_waiter_gap",
      cronRes.ok && hasGapTell && (nudges >= 1 || viewHasWaiterGapLayer(view5)),
      `cron=${cronRes.status} nudges=${nudges} gapTell=${hasGapTell} viewGap=${viewHasWaiterGapLayer(view5)}`,
      results
    );
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  console.log(`\n=== ${passed}/${results.length} PASS, ${failed} FAIL ===`);
  if (failed > 0) {
    console.log(
      "\nNote: eval:denis PASS alone does not mark ADR COMPLETE — fix pilot failures first."
    );
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
