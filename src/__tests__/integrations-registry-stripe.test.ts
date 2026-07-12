import { describe, expect, it } from "vitest";
import { resolveConnectorStatuses } from "@/lib/integrations/registry";

type TableResponse = { data: unknown; error: null };

function fakeAdmin(responses: Record<string, TableResponse>) {
  return {
    from(table: string) {
      const response = responses[table] ?? { data: null, error: null };
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => response,
        then: (resolve: (value: TableResponse) => unknown) =>
          resolve(response),
      };
      return builder;
    },
  } as never;
}

describe("resolveConnectorStatuses — Stripe", () => {
  it("reports not_connected when the org never finished Stripe onboarding", async () => {
    const admin = fakeAdmin({
      pos_integrations: { data: [], error: null },
      locations: {
        data: { org_id: "org-1", payment_online_enabled: true },
        error: null,
      },
      organizations: { data: { stripe_onboarded: false }, error: null },
    });

    const statuses = await resolveConnectorStatuses(admin, "loc-1");
    const stripe = statuses.find((s) => s.id === "stripe");

    expect(stripe?.state).toBe("not_connected");
  });

  it("reports not_connected (with an explanatory error) when Stripe is onboarded but online payment is off for this location", async () => {
    const admin = fakeAdmin({
      pos_integrations: { data: [], error: null },
      locations: {
        data: { org_id: "org-1", payment_online_enabled: false },
        error: null,
      },
      organizations: { data: { stripe_onboarded: true }, error: null },
    });

    const statuses = await resolveConnectorStatuses(admin, "loc-1");
    const stripe = statuses.find((s) => s.id === "stripe");

    expect(stripe?.state).toBe("not_connected");
    expect(stripe?.lastError).toContain("switched off");
  });

  it("reports connected only when both Stripe onboarding and the location's online-payment toggle are true", async () => {
    const admin = fakeAdmin({
      pos_integrations: { data: [], error: null },
      locations: {
        data: { org_id: "org-1", payment_online_enabled: true },
        error: null,
      },
      organizations: { data: { stripe_onboarded: true }, error: null },
    });

    const statuses = await resolveConnectorStatuses(admin, "loc-1");
    const stripe = statuses.find((s) => s.id === "stripe");

    expect(stripe?.state).toBe("connected");
    expect(stripe?.healthy).toBe(true);
  });

  it("reports not_connected when the location itself can't be found", async () => {
    const admin = fakeAdmin({
      pos_integrations: { data: [], error: null },
      locations: { data: null, error: null },
    });

    const statuses = await resolveConnectorStatuses(admin, "loc-missing");
    const stripe = statuses.find((s) => s.id === "stripe");

    expect(stripe?.state).toBe("not_connected");
  });
});
