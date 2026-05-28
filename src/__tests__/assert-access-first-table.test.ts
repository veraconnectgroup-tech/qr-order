import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertOrderAccess } from "@/lib/orders/create/pipeline/assert-access";
import type { ResolvedContext } from "@/lib/orders/create/types";
import type { CreateOrderInput } from "@/lib/orders/create/schema";

vi.mock("@/lib/sessions/order-blocks", () => ({
  assertDeviceNotBlocked: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/sessions/session-lifecycle", () => ({
  isSessionOrderBlocked: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/sessions/session-devices", () => ({
  getActiveTableSession: vi.fn(),
  getPendingApprovalOrder: vi.fn(),
  createActiveSessionWithPin: vi.fn(),
  trustSessionDevice: vi.fn(),
}));

vi.mock("@/lib/orders/guest-order-access", () => ({
  assertGuestCanPlaceOrder: vi.fn(),
}));

vi.mock("@/lib/orders/validate-table-session", () => ({
  validateTableSession: vi.fn(),
}));

import { assertDeviceNotBlocked } from "@/lib/sessions/order-blocks";
import {
  createActiveSessionWithPin,
  getActiveTableSession,
  getPendingApprovalOrder,
  trustSessionDevice,
} from "@/lib/sessions/session-devices";

const admin = {} as never;

const baseContext = (requireFirstTableApproval: boolean): ResolvedContext => ({
  table: {
    id: "table-1",
    name: "T1",
    location_id: "loc-1",
    zone_id: null,
    assigned_staff_id: null,
  },
  location: {
    id: "loc-1",
    org_id: "org-1",
    accepting_orders: true,
    ordering_enabled: true,
    payment_online_enabled: true,
    payment_at_bar_enabled: true,
    payment_card_at_table_enabled: true,
    require_first_table_approval: requireFirstTableApproval,
  },
  org: {
    id: "org-1",
    default_tax_percent: 19,
    currency: "EUR",
    stripe_onboarded: false,
    stripe_account_id: null,
  },
});

const input = {
  tableToken: "qr-token",
  deviceFingerprint: "fp_test",
} as CreateOrderInput;

describe("assertOrderAccess first table approval setting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertDeviceNotBlocked).mockResolvedValue({ ok: true });
    vi.mocked(getActiveTableSession).mockResolvedValue(null);
    vi.mocked(getPendingApprovalOrder).mockResolvedValue(null);
  });

  it("returns approval mode when first table confirmation is required", async () => {
    const result = await assertOrderAccess(admin, input, baseContext(true));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        kind: "approval",
        deviceFingerprint: "fp_test",
      });
    }
    expect(createActiveSessionWithPin).not.toHaveBeenCalled();
  });

  it("auto-opens session when first table confirmation is disabled", async () => {
    vi.mocked(createActiveSessionWithPin).mockResolvedValue({
      sessionId: "sess-1",
      sessionToken: "sess-token",
      pinPlain: "1234",
    });
    vi.mocked(trustSessionDevice).mockResolvedValue({ deviceToken: "dev-token" });

    const result = await assertOrderAccess(admin, input, baseContext(false));

    expect(createActiveSessionWithPin).toHaveBeenCalledWith(admin, {
      tableId: "table-1",
      locationId: "loc-1",
    });
    expect(trustSessionDevice).toHaveBeenCalledWith(admin, {
      sessionId: "sess-1",
      deviceFingerprint: "fp_test",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        kind: "normal",
        sessionId: "sess-1",
        sessionOpened: {
          sessionId: "sess-1",
          sessionToken: "sess-token",
          deviceToken: "dev-token",
          tablePin: "1234",
        },
      });
    }
  });
});
