#!/usr/bin/env node
/**
 * Grant AI credits to an organization.
 *
 * Usage:
 *   node scripts/grant-ai-credits.mjs 500
 *   node scripts/grant-ai-credits.mjs 500 --org "Demo"
 *   node scripts/grant-ai-credits.mjs --list
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const admin = createClient(url, key);

const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const orgFlagIdx = args.indexOf("--org");
const orgQuery = orgFlagIdx >= 0 ? args[orgFlagIdx + 1] : null;
const amountRaw = args.find((a) => /^\d+$/.test(a));
const amount = amountRaw ? Number.parseInt(amountRaw, 10) : 500;

const { data: orgs, error: orgError } = await admin
  .from("organizations")
  .select("id, name, slug")
  .order("name");

if (orgError) {
  console.error("Could not load organizations:", orgError.message);
  process.exit(1);
}

if (!orgs?.length) {
  console.error("No organizations found.");
  process.exit(1);
}

console.log("Organizations:");
for (const org of orgs) {
  console.log(`  - ${org.name} (${org.slug})  id=${org.id}`);
}

if (listOnly) {
  process.exit(0);
}

let target = orgs[0];
if (orgQuery) {
  const q = orgQuery.toLowerCase();
  target =
    orgs.find(
      (o) =>
        o.id === orgQuery ||
        o.slug?.toLowerCase() === q ||
        o.name?.toLowerCase().includes(q)
    ) ?? null;
  if (!target) {
    console.error(`No organization matching "${orgQuery}"`);
    process.exit(1);
  }
}

const { data: newBalance, error: rpcError } = await admin.rpc("add_ai_credits", {
  p_org_id: target.id,
  p_amount: amount,
});

if (rpcError) {
  console.error("add_ai_credits failed:", rpcError.message);
  process.exit(1);
}

console.log(
  `\nAdded ${amount} credits to "${target.name}". New balance: ${newBalance}`
);
