import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  approveAdapterVersion,
  listPendingAdapterReviews,
  loadAdapterReviewDetail,
  rejectAdapterVersion,
  requestAdapterReview,
} from "@/lib/denis/integrations/review/adapter-review-workflow";

// Minimal in-memory fake mirroring the exact chains adapter-review-workflow.ts
// uses: select/eq/in/order/maybeSingle, insert().select().maybeSingle(),
// update().eq()...maybeSingle() and update().eq() (awaited directly).
type Row = Record<string, unknown>;

function makeFakeAdmin(tables: Record<string, Row[]>): SupabaseClient {
  function query(table: string) {
    let rows = [...(tables[table] ?? [])];
    let pendingUpdate: Row | null = null;
    let pendingInsert: Row | null = null;
    let selectAfterMutate = false;

    const builder = {
      select(_cols?: string) {
        selectAfterMutate = true;
        return builder;
      },
      eq(col: string, val: unknown) {
        rows = rows.filter((r) => r[col] === val);
        return builder;
      },
      in(col: string, vals: unknown[]) {
        rows = rows.filter((r) => vals.includes(r[col]));
        return builder;
      },
      order(_col: string, _opts?: unknown) {
        return builder;
      },
      insert(row: Row) {
        const withId = { id: `generated-${tables[table]!.length + 1}`, ...row };
        tables[table]!.push(withId);
        pendingInsert = withId;
        rows = [withId];
        return builder;
      },
      update(patch: Row) {
        pendingUpdate = patch;
        return builder;
      },
      async maybeSingle() {
        if (pendingUpdate) {
          rows = rows.map((r) => ({ ...r, ...pendingUpdate }));
          const idx = tables[table]!.findIndex((r) => r.id === rows[0]?.id);
          if (idx >= 0) tables[table]![idx] = rows[0]!;
        }
        return { data: rows[0] ?? null, error: null };
      },
      then(resolve: (value: { data: Row[] | null; error: null }) => unknown) {
        if (pendingUpdate) {
          rows = rows.map((r) => ({ ...r, ...pendingUpdate }));
          for (const updated of rows) {
            const idx = tables[table]!.findIndex((r) => r.id === updated.id);
            if (idx >= 0) tables[table]![idx] = updated;
          }
        }
        void pendingInsert;
        void selectAfterMutate;
        return resolve({ data: rows, error: null });
      },
    };
    return builder;
  }

  return { from: (table: string) => query(table) } as unknown as SupabaseClient;
}

function baseTables(): Record<string, Row[]> {
  return {
    integration_providers: [
      { id: "prov-1", name: "Acme POS", category: "pos", integration_kind: "api", status: "not_built" },
    ],
    integration_adapters: [
      { id: "adapter-1", provider_id: "prov-1", current_version_id: null, kind: "api", file_path: null },
    ],
    integration_adapter_versions: [
      {
        id: "version-1",
        adapter_id: "adapter-1",
        version_number: 1,
        generated_code: "export class AcmeAdapter {}",
        generated_at: new Date().toISOString(),
        generated_by: "ai",
        status: "sandbox_verified",
      },
    ],
    integration_capabilities: [
      {
        id: "cap-1",
        provider_id: "prov-1",
        capability: "order.create",
        status: "supported",
        endpoint: "POST /orders",
        side_effect_level: "mutating",
        quoted_span: "Creates a new order.",
      },
    ],
    integration_approval_requests: [],
  };
}

describe("adapter-review-workflow", () => {
  let tables: Record<string, Row[]>;
  let admin: SupabaseClient;

  beforeEach(() => {
    tables = baseTables();
    admin = makeFakeAdmin(tables);
  });

  it("requestAdapterReview creates a pending request for a sandbox_verified version", async () => {
    const result = await requestAdapterReview(admin, {
      adapterVersionId: "version-1",
      requestedByStaffId: "staff-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.decision).toBe("pending");
      expect(result.request.adapter_version_id).toBe("version-1");
    }
  });

  it("requestAdapterReview refuses a version that hasn't passed sandbox tests", async () => {
    tables.integration_adapter_versions![0]!.status = "generated";
    const result = await requestAdapterReview(admin, {
      adapterVersionId: "version-1",
      requestedByStaffId: "staff-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("not_sandbox_verified");
  });

  it("requestAdapterReview refuses a duplicate pending request", async () => {
    await requestAdapterReview(admin, {
      adapterVersionId: "version-1",
      requestedByStaffId: "staff-1",
    });
    const second = await requestAdapterReview(admin, {
      adapterVersionId: "version-1",
      requestedByStaffId: "staff-1",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("already_pending");
  });

  it("listPendingAdapterReviews joins version/adapter/provider for pending requests", async () => {
    await requestAdapterReview(admin, {
      adapterVersionId: "version-1",
      requestedByStaffId: "staff-1",
    });

    const pending = await listPendingAdapterReviews(admin);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.provider.name).toBe("Acme POS");
    expect(pending[0]?.version.version_number).toBe(1);
  });

  it("loadAdapterReviewDetail includes the provider's capability manifest", async () => {
    const created = await requestAdapterReview(admin, {
      adapterVersionId: "version-1",
      requestedByStaffId: "staff-1",
    });
    if (!created.ok) throw new Error("setup failed");

    const detail = await loadAdapterReviewDetail(admin, created.request.id);
    expect(detail?.capabilities).toHaveLength(1);
    expect(detail?.capabilities[0]?.capability).toBe("order.create");
    expect(detail?.version.generated_code).toContain("AcmeAdapter");
  });

  it("approveAdapterVersion moves the version to human_reviewed and sets current_version_id", async () => {
    const created = await requestAdapterReview(admin, {
      adapterVersionId: "version-1",
      requestedByStaffId: "staff-1",
    });
    if (!created.ok) throw new Error("setup failed");

    const result = await approveAdapterVersion(admin, {
      approvalRequestId: created.request.id,
      staffId: "staff-2",
      reviewNotes: "Looks good.",
    });
    expect(result.ok).toBe(true);
    expect(tables.integration_adapter_versions![0]!.status).toBe("human_reviewed");
    expect(tables.integration_adapters![0]!.current_version_id).toBe("version-1");
    expect(tables.integration_approval_requests![0]!.decision).toBe("approved");
  });

  it("rejectAdapterVersion moves the version to disabled and never sets current_version_id", async () => {
    const created = await requestAdapterReview(admin, {
      adapterVersionId: "version-1",
      requestedByStaffId: "staff-1",
    });
    if (!created.ok) throw new Error("setup failed");

    const result = await rejectAdapterVersion(admin, {
      approvalRequestId: created.request.id,
      staffId: "staff-2",
      reviewNotes: "Auth scheme unclear from the source doc.",
    });
    expect(result.ok).toBe(true);
    expect(tables.integration_adapter_versions![0]!.status).toBe("disabled");
    expect(tables.integration_adapters![0]!.current_version_id).toBeNull();
  });

  it("approveAdapterVersion refuses an already-decided request", async () => {
    const created = await requestAdapterReview(admin, {
      adapterVersionId: "version-1",
      requestedByStaffId: "staff-1",
    });
    if (!created.ok) throw new Error("setup failed");

    await approveAdapterVersion(admin, {
      approvalRequestId: created.request.id,
      staffId: "staff-2",
      reviewNotes: null,
    });

    const second = await approveAdapterVersion(admin, {
      approvalRequestId: created.request.id,
      staffId: "staff-2",
      reviewNotes: null,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("not_pending");
  });
});
