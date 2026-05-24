/**
 * Integration smoke test: outbox claim → handler → done.
 * Usage: pnpm exec tsx scripts/test-outbox-flow.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
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
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    console.warn("No .env.local — using process.env");
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("=== Outbox integration test ===\n");

  const { data: pendingBefore } = await admin
    .from("outbox_events")
    .select("id, event_type, status")
    .in("status", ["pending", "failed", "processing"])
    .limit(5);

  console.log("Pending/failed before:", pendingBefore?.length ?? 0);

  let testEventId: string | null = null;

  if (!pendingBefore?.length) {
    const { data: order } = await admin
      .from("orders")
      .select("id, location_id, order_number, total")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!order) {
      console.error("No orders in DB — place a demo order first.");
      process.exit(1);
    }

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", order.location_id)
      .single();

    const { data: table } = await admin
      .from("tables")
      .select("name")
      .eq("id", (order as { table_id?: string }).table_id ?? "")
      .maybeSingle();

    const o = order as {
      id: string;
      location_id: string;
      order_number: number;
      total: number;
    };

    const { data: inserted, error: insErr } = await admin
      .from("outbox_events")
      .insert({
        aggregate_type: "order",
        aggregate_id: o.id,
        domain: "fulfillment",
        event_type: "fulfill.notify_staff",
        payload: {
          orderId: o.id,
          locationId: o.location_id,
          orgId: (location as { org_id: string } | null)?.org_id,
          orderNumber: o.order_number,
          tableName: (table as { name: string } | null)?.name ?? "Test",
          total: o.total,
        },
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      console.error("Failed to insert test outbox event:", insErr?.message);
      process.exit(1);
    }

    testEventId = (inserted as { id: string }).id;
    console.log("Inserted test outbox event:", testEventId);
  }

  if (!cronSecret) {
    console.warn("CRON_SECRET missing — importing processor directly...");
    const { processOutboxBatch } = await import("../src/lib/outbox/processor");
    const result = await processOutboxBatch();
    console.log("Processor result:", result);
  } else {
    const res = await fetch(`${appUrl}/api/jobs/outbox-process`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const body = await res.json();
    console.log("HTTP", res.status, body);
    if (!res.ok) process.exit(1);
  }

  if (testEventId) {
    const { data: row } = await admin
      .from("outbox_events")
      .select("id, event_type, status, attempts, last_error, processed_at")
      .eq("id", testEventId)
      .single();

    console.log("\nTest event after process:", row);

    if ((row as { status: string } | null)?.status !== "done") {
      console.error("FAIL: expected status=done");
      process.exit(1);
    }
    console.log("\n✅ Outbox smoke test PASSED");
    return;
  }

  const { data: doneRecent } = await admin
    .from("outbox_events")
    .select("id, event_type, status, processed_at")
    .eq("status", "done")
    .order("processed_at", { ascending: false })
    .limit(3);

  console.log("\nRecently completed events:", doneRecent);

  if (!doneRecent?.length) {
    console.error("FAIL: no done events after process");
    process.exit(1);
  }

  console.log("\n✅ Outbox smoke test PASSED (processed existing queue)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
