/**
 * One-off local bootstrap: inspect Denis station-question pipeline and
 * create a test question when none are open.
 *
 * Usage: tsx scripts/denis-station-question-bootstrap.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { runSessionWatcherTick } from "@/lib/denis/runtime/run-session-watcher";
import {
  buildStationQuestionMessage,
  stationForOrder,
} from "@/lib/denis/stations/question-triggers";
import {
  createStationQuestion,
  expireStaleStationQuestionsGlobally,
} from "@/lib/denis/stations/station-questions";
import { isKitchenMenuSection } from "@/lib/kitchen/menu-section";

function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
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
        if (val.trim().length > 0) process.env[key] = val;
      }
    } catch {
      // optional
    }
  }
}

async function main() {
  loadEnvFiles();

  const admin = createAdminClient();

  const { data: sessions, error: sessionsError } = await admin
    .from("table_sessions")
    .select("id, location_id, opened_at, denis_shared_ai_session_id, status")
    .eq("status", "active")
    .order("opened_at", { ascending: false })
    .limit(5);

  if (sessionsError) {
    console.error("table_sessions query failed:", sessionsError.message);
    process.exit(1);
  }

  console.log("Active table sessions:", sessions?.length ?? 0);
  const lookbackHours = 24;
  for (const row of sessions ?? []) {
    const r = row as {
      id: string;
      location_id: string;
      opened_at: string;
      denis_shared_ai_session_id: string | null;
    };
    const hoursOpen =
      (Date.now() - Date.parse(r.opened_at)) / (60 * 60 * 1000);
    const inWatcherWindow = hoursOpen <= lookbackHours;
    console.log(
      `  • ${r.id.slice(0, 8)}… denis=${r.denis_shared_ai_session_id ? "yes" : "no"} opened=${hoursOpen.toFixed(1)}h ago watcher=${inWatcherWindow ? "yes" : "NO (>6h)"}`
    );
  }

  const { data: openQuestions } = await admin
    .from("station_questions")
    .select("id, location_id, station, message, expires_at")
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .order("asked_at", { ascending: false })
    .limit(5);

  console.log("\nOpen station questions:", openQuestions?.length ?? 0);
  for (const row of openQuestions ?? []) {
    const r = row as {
      id: string;
      station: string;
      message: string;
      expires_at: string;
    };
    console.log(`  • [${r.station}] ${r.message.slice(0, 80)}…`);
  }

  const watcherBefore = await runSessionWatcherTick(admin, { limit: 80 });
  console.log("\nSession watcher (before):", watcherBefore);

  const expiredCount = await expireStaleStationQuestionsGlobally(admin);
  if (expiredCount > 0) {
    console.log(`\nExpired ${expiredCount} stale open question(s).`);
  }

  const { data: openAfterExpire } = await admin
    .from("station_questions")
    .select("id, station, message")
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .order("asked_at", { ascending: false })
    .limit(5);

  if ((openAfterExpire?.length ?? 0) > 0) {
    console.log("\n✅ Open question(s) already exist:");
    for (const row of openAfterExpire ?? []) {
      const r = row as { station: string; message: string };
      console.log(`   [${r.station}] ${r.message}`);
    }
    console.log("\nOpen /kitchen or /bar and click Aktiviraj Denisa.");
    return;
  }

  type OrderRow = {
    id: string;
    location_id: string;
    table_id: string | null;
    order_number: number | null;
    created_at: string;
    status: string;
    order_items: Array<{ menu_section: string | null }>;
    table: { name: string } | { name: string }[] | null;
  };

  const { data: orders } = await admin
    .from("orders")
    .select(
      "id, location_id, table_id, order_number, created_at, status, order_items(menu_section), table:tables(name)"
    )
    .in("status", ["pending", "pending_approval", "accepted", "preparing"])
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("\nCandidate orders:", orders?.length ?? 0);

  const orderRows = (orders ?? []) as OrderRow[];
  const created: string[] = [];

  for (const station of ["kitchen", "bar"] as const) {
    const target = orderRows.find((row) => {
      const hasKitchen = row.order_items.some((item) =>
        isKitchenMenuSection(item.menu_section)
      );
      const hasDrinks = row.order_items.some(
        (item) => item.menu_section === "drinks"
      );
      const rowStation = stationForOrder({
        hasKitchenItems: hasKitchen,
        hasDrinkItems: hasDrinks,
      });
      return rowStation === station;
    });

    if (!target) {
      console.log(`\nNo ${station} order candidate — skipping.`);
      continue;
    }

    const tableName = Array.isArray(target.table)
      ? target.table[0]?.name
      : target.table?.name;

    const config = await loadConciergeConfigForLocation(target.location_id);
    if (!config.ops.stationQuestions.enabled) {
      console.error(
        `Station questions disabled for location ${target.location_id}`
      );
      continue;
    }

    const waitMinutes = Math.max(
      5,
      Math.floor((Date.now() - Date.parse(target.created_at)) / 60_000)
    );

    const result = await createStationQuestion(admin, {
      locationId: target.location_id,
      orderId: target.id,
      tableId: target.table_id,
      station,
      questionType: "eta",
      message: buildStationQuestionMessage({
        questionType: "eta",
        station,
        tableName: tableName ?? "—",
        orderNumber: target.order_number,
        waitMinutes,
      }),
      askedBy: "denis",
      sourceEvent: "sla_breach",
      config: config.ops.stationQuestions,
    });

    if (result.created) {
      created.push(`[${station}] ${result.question.message}`);
      console.log(`\n✅ Created ${station} question: ${result.question.id}`);
    } else {
      console.log(`\n⚠️  ${station} question not created:`, result.reason);
    }
  }

  if (created.length === 0) {
    console.log(
      "\n⚠️  No open food/drink orders — create one via guest QR first:"
    );
    console.log("   http://localhost:3000/skyline-lounge/demo-table-1");
    return;
  }

  console.log("\nCreated:");
  for (const line of created) console.log(`   ${line}`);

  const watcherAfter = await runSessionWatcherTick(admin, { limit: 80 });
  console.log("\nSession watcher (after):", watcherAfter);

  console.log("\nNext:");
  console.log("   1. Open http://localhost:3000/kitchen (or /bar for bar questions)");
  console.log("   2. Hard refresh (Cmd+Shift+R)");
  console.log("   3. Click Aktiviraj Denisa — Denis should ask the question");
  console.log(
    "\nNote: watcher lookback is 24h — sessions older than that are skipped for auto triggers."
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
