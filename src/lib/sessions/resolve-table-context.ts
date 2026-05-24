import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveDeviceBlock } from "@/lib/sessions/order-blocks";
import {
  getActiveTableSession,
  getPendingApprovalOrder,
  isTrustedDevice,
} from "@/lib/sessions/session-devices";

type AdminClient = SupabaseClient;

export type TableGuestContext = {
  tableId: string;
  tableName: string;
  locationId: string;
  sessionStatus: "none" | "active" | "closed";
  sessionToken: string | null;
  sessionId: string | null;
  billStatus: "open" | "settled" | "void" | null;
  hasPin: boolean;
  pendingApprovalOrderId: string | null;
  capabilities: {
    canBrowseMenu: true;
    canViewBill: boolean;
    canViewOrderStatus: boolean;
    canPlaceOrders: boolean;
    needsPin: boolean;
    awaitingApproval: boolean;
    deviceBlocked: boolean;
    deviceBlockedUntil: string | null;
  };
};

export async function resolveTableGuestContext(
  admin: AdminClient,
  tableToken: string,
  input?: {
    deviceFingerprint?: string;
    deviceToken?: string;
  }
): Promise<{ data: TableGuestContext } | { error: string; status: number }> {
  const { data: table } = await admin
    .from("tables")
    .select("id, name, location_id")
    .eq("qr_token", tableToken)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();

  if (!table) {
    return { error: "Invalid QR code", status: 404 };
  }

  const tableRow = table as {
    id: string;
    name: string;
    location_id: string;
  };

  const session = await getActiveTableSession(admin, tableRow.id);
  const pending = await getPendingApprovalOrder(admin, tableRow.id);

  let trusted = false;
  if (session && input?.deviceFingerprint && input?.deviceToken) {
    trusted = await isTrustedDevice(admin, {
      sessionId: session.id,
      deviceToken: input.deviceToken,
      deviceFingerprint: input.deviceFingerprint,
    });
  }

  const sessionActive = Boolean(session);
  const awaitingApproval = Boolean(pending);

  let deviceBlock: { blocked_until: string } | null = null;
  if (input?.deviceFingerprint) {
    deviceBlock = await getActiveDeviceBlock(
      admin,
      tableRow.id,
      input.deviceFingerprint
    );
  }
  const deviceBlocked = Boolean(deviceBlock);

  const canOrderWithSession = sessionActive && trusted && !awaitingApproval;
  const canOrderFirstVisit = !sessionActive && !awaitingApproval;

  return {
    data: {
      tableId: tableRow.id,
      tableName: tableRow.name,
      locationId: tableRow.location_id,
      sessionStatus: session ? "active" : "none",
      sessionToken: session?.session_token ?? null,
      sessionId: session?.id ?? null,
      billStatus: (session?.bill_status ?? null) as
        | "open"
        | "settled"
        | "void"
        | null,
      hasPin: Boolean(session?.order_pin_hash),
      pendingApprovalOrderId: pending?.id ?? null,
      capabilities: {
        canBrowseMenu: true,
        canViewBill: sessionActive,
        canViewOrderStatus: sessionActive,
        canPlaceOrders:
          !deviceBlocked && (canOrderWithSession || canOrderFirstVisit),
        needsPin: sessionActive && !trusted && !deviceBlocked,
        awaitingApproval,
        deviceBlocked,
        deviceBlockedUntil: deviceBlock?.blocked_until ?? null,
      },
    },
  };
}
