import { describe, expect, it, vi } from "vitest";

type TableResponse = { data: unknown; error: null };

function fakeAdmin(responses: Record<string, TableResponse>) {
  return {
    from(table: string) {
      const response = responses[table] ?? { data: null, error: null };
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => response,
        then: (resolve: (value: TableResponse) => unknown) => resolve(response),
      };
      return builder;
    },
  };
}

describe("loadFullCapabilityAwarenessBlock", () => {
  it("returns null when no POS is connected — nothing to detail", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () =>
        fakeAdmin({
          pos_integrations: { data: [], error: null },
        }),
    }));
    const { loadFullCapabilityAwarenessBlock } = await import(
      "@/lib/integrations/registry"
    );

    const block = await loadFullCapabilityAwarenessBlock("loc-1");

    expect(block).toBeNull();
  });

  it("lists all 11 capability keys, including pos_dependent, when a POS is connected", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () =>
        fakeAdmin({
          pos_integrations: {
            data: [
              {
                provider: "deliverect",
                status: "connected",
                config: { pos_vendor: "toast" },
              },
            ],
            error: null,
          },
        }),
    }));
    const { loadFullCapabilityAwarenessBlock } = await import(
      "@/lib/integrations/registry"
    );

    const block = await loadFullCapabilityAwarenessBlock("loc-1");

    expect(block).toContain("FULL CAPABILITY DETAIL");
    // dineInOrder is "confirmed" baseline — must appear even though it's
    // NOT in the guest-safe 6-key subset loadCapabilityAwarenessBlock uses.
    expect(block).toContain("sending a dine-in order to the POS: confirmed");
    // tableIdRealRouting is pos_dependent — must appear here even though
    // the guest-facing block deliberately omits pos_dependent entries.
    expect(block).toContain("routing an order to the exact table on the POS screen: pos_dependent");
    expect(block).toContain("not all POS systems currently return the table IDs");
  });
});
