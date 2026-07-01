import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase/migrations");

/** Layer 10 tables that must ship with RLS enabled. */
const LAYER10_RLS_TABLES = ["denis_turn_traces"] as const;

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8");
}

describe("RLS coverage — Layer 10 migrations", () => {
  it("denis_turn_traces enables row level security", () => {
    const sql = readMigration("00132_denis_turn_traces.sql");
    expect(sql).toContain("CREATE TABLE");
    expect(sql).toContain("denis_turn_traces");
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/CREATE POLICY/i);
  });

  for (const table of LAYER10_RLS_TABLES) {
    it(`${table} migration references service_role policy`, () => {
      const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.endsWith(".sql"))
        .sort();

      const migration = files.find((file) => {
        const sql = readMigration(file);
        return sql.includes(`CREATE TABLE`) && sql.includes(table);
      });

      expect(migration, `migration creating ${table}`).toBeTruthy();
      const sql = readMigration(migration!);
      expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
      expect(sql).toContain("service_role");
    });
  }
});
