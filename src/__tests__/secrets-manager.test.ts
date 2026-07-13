import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/env", () => ({
  env: { integrationCredentialsEncryptionKey: "test-key" },
}));

describe("secrets-manager", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("storeCredential calls the RPC with the encryption key from env, never inline", async () => {
    const { storeCredential } = await import(
      "@/lib/denis/integrations/secrets/secrets-manager"
    );
    const rpc = vi.fn().mockResolvedValue({ data: "cred-1", error: null });
    const admin = { rpc } as unknown as SupabaseClient;

    const result = await storeCredential(admin, {
      providerId: "prov-1",
      locationId: "loc-1",
      environment: "sandbox",
      credentialType: "api_key",
      value: "sk_test_abc123",
      createdByStaffId: "staff-1",
    });

    expect(result).toEqual({ ok: true, id: "cred-1" });
    expect(rpc).toHaveBeenCalledWith(
      "store_integration_credential",
      expect.objectContaining({
        p_provider_id: "prov-1",
        p_location_id: "loc-1",
        p_environment: "sandbox",
        p_credential_type: "api_key",
        p_value: "sk_test_abc123",
        p_encryption_key: "test-key",
        p_created_by_staff_id: "staff-1",
      })
    );
  });

  it("storeCredential rejects an empty value without calling the RPC", async () => {
    const { storeCredential } = await import(
      "@/lib/denis/integrations/secrets/secrets-manager"
    );
    const rpc = vi.fn();
    const admin = { rpc } as unknown as SupabaseClient;

    const result = await storeCredential(admin, {
      providerId: "prov-1",
      locationId: "loc-1",
      environment: "sandbox",
      credentialType: "api_key",
      value: "   ",
      createdByStaffId: null,
    });

    expect(result).toEqual({ ok: false, error: "empty_value" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("resolveCredentialValue returns the decrypted value from the RPC", async () => {
    const { resolveCredentialValue } = await import(
      "@/lib/denis/integrations/secrets/secrets-manager"
    );
    const rpc = vi.fn().mockResolvedValue({ data: "sk_test_abc123", error: null });
    const admin = { rpc } as unknown as SupabaseClient;

    const value = await resolveCredentialValue(admin, "cred-1");
    expect(value).toBe("sk_test_abc123");
    expect(rpc).toHaveBeenCalledWith("read_integration_credential", {
      p_id: "cred-1",
      p_encryption_key: "test-key",
    });
  });

  it("resolveCredentialValue returns null on error, never throws", async () => {
    const { resolveCredentialValue } = await import(
      "@/lib/denis/integrations/secrets/secrets-manager"
    );
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const admin = { rpc } as unknown as SupabaseClient;

    expect(await resolveCredentialValue(admin, "cred-1")).toBeNull();
  });

  it("resolveSandboxCredentialValue fails closed for a production credentialRef", async () => {
    const { resolveSandboxCredentialValue } = await import(
      "@/lib/denis/integrations/secrets/secrets-manager"
    );
    // Simulates the row existing but NOT matching environment='sandbox' —
    // the .eq("environment","sandbox") filter means maybeSingle() finds nothing.
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq2 = vi.fn(() => ({ maybeSingle }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const rpc = vi.fn();
    const admin = { from: () => ({ select }), rpc } as unknown as SupabaseClient;

    const value = await resolveSandboxCredentialValue(admin, "prod-cred-1");
    expect(value).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("resolveSandboxCredentialValue decrypts when the row is genuinely sandbox-scoped", async () => {
    const { resolveSandboxCredentialValue } = await import(
      "@/lib/denis/integrations/secrets/secrets-manager"
    );
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "cred-1", environment: "sandbox" }, error: null });
    const eq2 = vi.fn(() => ({ maybeSingle }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const rpc = vi.fn().mockResolvedValue({ data: "sk_test_abc123", error: null });
    const admin = { from: () => ({ select }), rpc } as unknown as SupabaseClient;

    const value = await resolveSandboxCredentialValue(admin, "cred-1");
    expect(value).toBe("sk_test_abc123");
  });

  it("listCredentialsForProvider never includes the decrypted value", async () => {
    const { listCredentialsForProvider } = await import(
      "@/lib/denis/integrations/secrets/secrets-manager"
    );
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "cred-1",
          provider_id: "prov-1",
          location_id: "loc-1",
          environment: "sandbox",
          credential_type: "api_key",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const eq2 = vi.fn(() => ({ order }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const admin = { from: () => ({ select }) } as unknown as SupabaseClient;

    const rows = await listCredentialsForProvider(admin, {
      providerId: "prov-1",
      locationId: "loc-1",
    });
    expect(rows).toEqual([
      {
        id: "cred-1",
        providerId: "prov-1",
        locationId: "loc-1",
        environment: "sandbox",
        credentialType: "api_key",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(Object.keys(rows[0]!)).not.toContain("value");
    expect(Object.keys(rows[0]!)).not.toContain("encryptedValue");
  });
});
