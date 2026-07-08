import { describe, expect, it } from "vitest";
import {
  buildAuditEntry,
  persistDenisAuditEntry,
} from "@/lib/denis/compliance/persist-denis-audit-entry";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("persistDenisAuditEntry", () => {
  it("inserts hashed guest input without raw message", async () => {
    const inserted: Record<string, unknown>[] = [];
    const admin = {
      from: () => ({
        insert: async (row: Record<string, unknown>) => {
          inserted.push(row);
          return { error: null };
        },
      }),
    } as unknown as SupabaseClient;

    const entry = buildAuditEntry({
      traceId: "trace-1",
      sessionId: "sess-1",
      guestMessage: "Hoću čokoladnu tortu",
      denisResponse: "Proveravam alergene.",
      turnPlan: { kind: "transactional_perceive" },
      tier: "T2",
      llmUsed: true,
      model: "gpt-test",
      latencyMs: 900,
      orderSubmitted: false,
      creditsCost: 1,
      guestMemoryUsed: false,
      evidencePointers: ["situation.pack"],
    });

    const ok = await persistDenisAuditEntry(admin, {
      orgId: "org-1",
      locationId: "loc-1",
      entry,
    });

    expect(ok).toBe(true);
    expect(inserted[0].guest_input_hash).toBe(entry.guestInputHash);
    expect(String(inserted[0].guest_input_hash)).not.toContain("tortu");
    expect(inserted[0].expires_at).toBeTruthy();
  });
});
