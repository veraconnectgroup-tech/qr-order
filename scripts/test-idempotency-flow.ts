/**
 * Idempotency smoke test against remote Supabase.
 * Usage: pnpm exec tsx scripts/test-idempotency-flow.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

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
    /* use process.env */
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const key = `test-idem-${randomUUID()}`;

  const { data: order } = await admin
    .from("orders")
    .select("id, location_id, table_id, session_id, order_number, total, tax_percent")
    .not("session_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!order) {
    console.log("SKIP: no session-backed order to clone idempotency pattern");
    process.exit(0);
  }

  const o = order as {
    id: string;
    location_id: string;
    table_id: string;
    session_id: string;
    order_number: number;
    total: number;
    tax_percent: number;
  };

  const { data: first, error: e1 } = await admin
    .from("orders")
    .insert({
      location_id: o.location_id,
      table_id: o.table_id,
      session_id: o.session_id,
      order_number: o.order_number + 9000,
      subtotal: 10,
      tax_percent: 19,
      tax_amount: 1.9,
      total: 11.9,
      discount_amount: 0,
      status: "pending",
      payment_status: "pending",
      payment_method: "unset",
      tip_amount: 0,
      is_takeaway: false,
      idempotency_key: key,
    })
    .select("id")
    .single();

  if (e1 || !first) {
    console.error("First insert failed:", e1?.message);
    process.exit(1);
  }

  const firstId = (first as { id: string }).id;

  const { error: e2 } = await admin.from("orders").insert({
    location_id: o.location_id,
    table_id: o.table_id,
    session_id: o.session_id,
    order_number: o.order_number + 9001,
    subtotal: 10,
    tax_percent: 19,
    tax_amount: 1.9,
    total: 11.9,
    discount_amount: 0,
    status: "pending",
    payment_status: "pending",
    payment_method: "unset",
    tip_amount: 0,
    is_takeaway: false,
    idempotency_key: key,
  });

  if (e2?.code !== "23505") {
    console.error("Expected unique violation, got:", e2);
    await admin.from("orders").delete().eq("id", firstId);
    process.exit(1);
  }

  const { findOrderByIdempotencyKey } = await import(
    "../src/lib/orders/idempotency"
  );
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const client = createAdminClient();
  const found = await findOrderByIdempotencyKey(client, key);

  await admin.from("orders").delete().eq("id", firstId);

  if (!found || found.orderId !== firstId) {
    console.error("FAIL: lookup did not return original order", found);
    process.exit(1);
  }

  console.log("✅ Idempotency DB constraint + lookup PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
