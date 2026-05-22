/**
 * One-off: create admin user and link to Skyline Lounge.
 * Usage: node --env-file=.env.local scripts/create-admin.mjs
 */
import { createClient } from "@supabase/supabase-js";

const EMAIL = "jovica@verait.de";
const PASSWORD = "admin123";
const SKYLINE_ORG_ID = "a0000000-0000-4000-8000-000000000001";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
  let userId;

  const existing = await findUserByEmail(EMAIL);
  if (existing) {
    console.log("User already exists, updating password...");
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  } else {
    console.log("Creating user...");
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: "Jovica" },
    });
    if (error) throw error;
    userId = data.user.id;
  }

  const { data: existingStaff } = await admin
    .from("staff")
    .select("id")
    .eq("user_id", userId)
    .eq("org_id", SKYLINE_ORG_ID)
    .maybeSingle();

  if (!existingStaff) {
    const { error: staffError } = await admin.from("staff").insert({
      user_id: userId,
      org_id: SKYLINE_ORG_ID,
      role: "owner",
      name: "Jovica",
      email: EMAIL,
      is_active: true,
    });
    if (staffError) throw staffError;
    console.log("Staff record linked to Skyline Lounge.");
  } else {
    console.log("Staff record already exists for Skyline Lounge.");
  }

  console.log("\nDone! Login at http://localhost:3000/login");
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log("\nChange the password after first login (Supabase Dashboard or app settings).");
}

main().catch((err) => {
  console.error("Failed:", err.message ?? err);
  process.exit(1);
});
