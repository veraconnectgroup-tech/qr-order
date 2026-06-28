/**
 * Viktor staff account + Operator API key on Skyline Lounge (production).
 *
 * Usage:
 *   supabase login
 *   node scripts/create-viktor-access.mjs
 *
 * Or with env file that includes SUPABASE_SERVICE_ROLE_KEY:
 *   node --env-file=.env.vercel.local scripts/create-viktor-access.mjs
 */
import { createHash, randomBytes } from "crypto";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

const EMAIL = "viktor@verait.de";
const NAME = "Viktor";
const ROLE = "manager";
const SKYLINE_ORG_ID = "a0000000-0000-4000-8000-000000000001";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://qr-order-iota.vercel.app";

function bootstrapFromSupabaseCli() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  if (hasUrl && hasKey) return true;

  let projectRef = "";
  try {
    projectRef = readFileSync(
      join(process.cwd(), "supabase/.temp/project-ref"),
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
    const keys = JSON.parse(raw);
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

bootstrapFromSupabaseCli();

const resolvedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const resolvedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!resolvedUrl || !resolvedKey) {
  console.error(
    "Missing Supabase credentials. Run: supabase login && node scripts/create-viktor-access.mjs"
  );
  process.exit(1);
}

const admin = createClient(resolvedUrl, resolvedKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generatePassword() {
  return randomBytes(12).toString("base64url");
}

function generateOperatorApiKey() {
  const token = randomBytes(24).toString("base64url");
  const rawKey = `dns_op_live_${token}`;
  const prefix = rawKey.slice(0, 16);
  const hash = createHash("sha256").update(rawKey).digest("hex");
  return { rawKey, prefix, hash };
}

async function findUserByEmail(email) {
  let page = 1;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) break;
    page++;
  }
  return null;
}

async function main() {
  const password = generatePassword();
  let userId;

  const existing = await findUserByEmail(EMAIL);
  if (existing) {
    console.log("User already exists, updating password...");
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  } else {
    console.log("Creating auth user...");
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password,
      email_confirm: true,
      user_metadata: { name: NAME },
    });
    if (error) throw error;
    userId = data.user.id;
  }

  const { data: existingStaff } = await admin
    .from("staff")
    .select("id, role")
    .eq("user_id", userId)
    .eq("org_id", SKYLINE_ORG_ID)
    .maybeSingle();

  if (!existingStaff) {
    const { error: staffError } = await admin.from("staff").insert({
      user_id: userId,
      org_id: SKYLINE_ORG_ID,
      role: ROLE,
      name: NAME,
      email: EMAIL,
      is_active: true,
    });
    if (staffError) throw staffError;
    console.log(`Staff record created (${ROLE}) for Skyline Lounge.`);
  } else {
    const { error: staffError } = await admin
      .from("staff")
      .update({ role: ROLE, is_active: true, name: NAME })
      .eq("id", existingStaff.id);
    if (staffError) throw staffError;
    console.log(`Staff record updated (${ROLE}).`);
  }

  const { rawKey, prefix, hash } = generateOperatorApiKey();
  const { data: existingKey } = await admin
    .from("operator_api_keys")
    .select("id")
    .eq("org_id", SKYLINE_ORG_ID)
    .eq("name", "Viktor integration")
    .is("revoked_at", null)
    .maybeSingle();

  let operatorKey = rawKey;
  if (existingKey) {
    console.log("Operator API key 'Viktor integration' already exists — skipping new key.");
    operatorKey = null;
  } else {
    const { error: keyError } = await admin.from("operator_api_keys").insert({
      org_id: SKYLINE_ORG_ID,
      name: "Viktor integration",
      key_hash: hash,
      key_prefix: prefix,
      scopes: ["operator:read", "operator:propose"],
    });
    if (keyError) throw keyError;
    console.log("Operator API key created.");
  }

  console.log("\n=== Viktor access ===");
  console.log(`Login:     ${APP_URL}/login`);
  console.log(`Dashboard: ${APP_URL}/dashboard/orders`);
  console.log(`Admin:     ${APP_URL}/admin/settings`);
  console.log(`Email:     ${EMAIL}`);
  console.log(`Password:  ${password}`);
  if (operatorKey) {
    console.log(`Operator API key (save now — shown once):\n  ${operatorKey}`);
    console.log(`Operator base: ${APP_URL}/api/operator/v1`);
  }
  console.log("\nShare credentials securely with Viktor. He should change password after first login.");
}

main().catch((err) => {
  console.error("Failed:", err.message ?? err);
  process.exit(1);
});
