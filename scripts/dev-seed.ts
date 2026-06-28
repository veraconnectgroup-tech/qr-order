/**
 * Local dev bootstrap — applies migrations and grants AI credits.
 *
 * Usage:
 *   pnpm dev:setup   — push migrations + grant credits (local Docker or remote)
 *   pnpm db:seed     — alias for dev:setup
 *
 * Local (Docker):
 *   pnpm db:start && pnpm dev:setup
 *
 * Remote (no Docker):
 *   SUPABASE_DB_PASSWORD=… pnpm dev:setup
 */
import { execSync } from "node:child_process";

const ORG_SLUG = process.env.DEV_SEED_ORG_SLUG ?? "skyline-lounge";

function dockerRunning(): boolean {
  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function pushMigrations(): void {
  if (dockerRunning()) {
    console.log("🔧 Applying migrations via local Supabase…");
    execSync("pnpm db:push", { stdio: "inherit" });
    console.log("📦 Regenerating local types…");
    execSync("pnpm db:types", { stdio: "inherit" });
    return;
  }

  if (process.env.SUPABASE_DB_PASSWORD?.trim()) {
    console.log("🔧 Docker offline — pushing migrations to linked remote…");
    execSync("supabase db push --linked --yes", {
      stdio: "inherit",
      env: process.env,
    });
    console.log(
      "ℹ️  Skipping db:types:remote (per ADR-001-safe-rollout). Types are maintained manually in src/types/database.ts."
    );
    return;
  }

  console.error("Cannot apply migrations:");
  console.error("  • Start Docker Desktop and run:  pnpm dev:setup");
  console.error("  • Or set SUPABASE_DB_PASSWORD and run:  pnpm dev:setup");
  process.exit(1);
}

async function main() {
  pushMigrations();

  console.log("💳 Granting AI credits to seed org…");
  execSync(`pnpm ai:grant-credits -- ${ORG_SLUG}`, { stdio: "inherit" });

  console.log("");
  console.log("✅ Dev setup complete");
  console.log(`   Guest QR:  http://localhost:3000/skyline-lounge/demo-table-1`);
  console.log(`   Dashboard: http://localhost:3000/dashboard`);
  console.log(`   Admin:     http://localhost:3000/admin`);
  console.log("");
  console.log("Next: pnpm dev");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
