/** Quick S3 replay against live iota — delete after pilot green. */
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const TABLE_TOKEN = "demo-table-1";
const FP = `iota-pilot-${TABLE_TOKEN}`;
const LOC = "b0000000-0000-4000-8000-000000000001";

function loadEnv() {
  for (const f of [".env.vercel.local", ".env.local"]) {
    try {
      for (const line of readFileSync(resolve(process.cwd(), f), "utf8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq < 0) continue;
        const k = t.slice(0, eq);
        let v = t.slice(eq + 1);
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
          v = v.slice(1, -1);
        if (v) process.env[k] = v;
      }
    } catch {
      /* optional */
    }
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const ref = readFileSync(resolve(process.cwd(), "supabase/.temp/project-ref"), "utf8").trim();
  const keys = JSON.parse(
    execSync(`supabase projects api-keys --project-ref ${ref} -o json`, { encoding: "utf8" })
  ) as Array<{ name?: string; api_key?: string }>;
  process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${ref}.supabase.co`;
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    keys.find((k) => k.name === "service_role")?.api_key ?? "";
}

loadEnv();

async function signal(
  base: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${base}/api/denis/signal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "message",
      language: "sr",
      allowOrdering: true,
      signalId: `dbg-${Date.now()}`,
      ...body,
    }),
  });
  const json = (await res.json()) as { data?: Record<string, unknown> };
  return (json.data ?? json) as Record<string, unknown>;
}

async function main() {
  const base = process.env.IOTA_URL ?? "https://qr-order-iota.vercel.app";
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { findOrCreateTableSession } = await import(
    "@/lib/sessions/find-or-create-table-session"
  );
  const { closeTableSession } = await import("@/lib/sessions/session-devices");
  const { registerPartyDevice } = await import("@/lib/denis/venue/party");

  const { data: table } = await admin
    .from("tables")
    .select("id, location_id")
    .eq("qr_token", TABLE_TOKEN)
    .single();
  const tableId = (table as { id: string }).id;
  const locationId = (table as { location_id: string }).location_id || LOC;

  for (const row of (await admin.from("table_sessions").select("id").eq("table_id", tableId).eq("status", "active")).data ?? []) {
    await closeTableSession(admin, (row as { id: string }).id, "void");
  }

  const session = await findOrCreateTableSession(admin, tableId, locationId);
  if ("error" in session) throw new Error(session.error);
  await registerPartyDevice(admin, {
    tableSessionId: session.sessionId,
    locationId,
    tableId,
    deviceFingerprint: FP,
  });

  const common = {
    tableToken: TABLE_TOKEN,
    sessionToken: session.sessionToken,
    locationId,
    tableId,
    deviceFingerprint: FP,
  };

  await signal(base, { ...common, text: "moze jedno pivo i beef burger" });
  await signal(base, { ...common, text: "da", structuredIntent: "CONFIRM" });
  await signal(base, { ...common, text: "pilsner" });
  const s3b = await signal(base, { ...common, text: "da", structuredIntent: "CONFIRM" });

  console.log(
    JSON.stringify(
      {
        submitOrder: s3b.submitOrder,
        orderSubmit: s3b.orderSubmit,
        message: s3b.message,
        denis: s3b.denis,
      },
      null,
      2
    )
  );

  const sharedId = (s3b.denis as { sharedAiSessionId?: string })?.sharedAiSessionId;
  if (sharedId) {
    const { data: events } = await admin
      .from("denis_timeline_events")
      .select("event_type, payload")
      .eq("ai_session_id", sharedId)
      .order("created_at", { ascending: false })
      .limit(5);
    console.log("\ntimeline:", JSON.stringify(events, null, 2));
  }

  const { data: orders } = await admin
    .from("orders")
    .select("id, order_number, status, created_at")
    .eq("table_id", tableId)
    .order("created_at", { ascending: false })
    .limit(2);
  console.log("\norders:", JSON.stringify(orders, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
