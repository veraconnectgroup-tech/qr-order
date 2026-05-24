import type { CreateOrderInput } from "@/lib/orders/create/schema";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import { assertGuestCanPlaceOrder } from "@/lib/orders/guest-order-access";
import {
  err,
  ok,
  type OrderCreateError,
  type Result,
} from "@/lib/orders/create/result";
import {
  orderError,
  sessionValidationError,
} from "@/lib/orders/create/pipeline/errors";
import type { OrderCreateMode, ResolvedContext } from "@/lib/orders/create/types";
import { assertDeviceNotBlocked } from "@/lib/sessions/order-blocks";
import {
  getActiveTableSession,
  getPendingApprovalOrder,
} from "@/lib/sessions/session-devices";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function assertOrderAccess(
  admin: AdminClient,
  input: CreateOrderInput,
  ctx: ResolvedContext,
  isDemo: boolean
): Promise<Result<OrderCreateMode, OrderCreateError>> {
  if (isDemo) {
    if (!input.sessionToken) {
      return err(orderError("session_required", "Session required.", 401));
    }

    const sessionResult = await validateTableSession(
      admin,
      input.tableToken,
      input.sessionToken
    );

    if ("error" in sessionResult) {
      return err(
        sessionValidationError(sessionResult.error, sessionResult.status)
      );
    }

    return ok({
      kind: "demo",
      sessionId: sessionResult.data.session.id,
    });
  }

  const blockCheck = await assertDeviceNotBlocked(
    admin,
    ctx.table.id,
    input.deviceFingerprint
  );

  if (!blockCheck.ok) {
    return err(
      orderError("device_blocked", "device_blocked", 403, {
        blockedUntil: blockCheck.blockedUntil,
      })
    );
  }

  const activeSession = await getActiveTableSession(admin, ctx.table.id);

  if (!activeSession) {
    const existingPending = await getPendingApprovalOrder(admin, ctx.table.id);
    if (existingPending) {
      return err(orderError("awaiting_approval", "awaiting_approval", 409));
    }

    return ok({
      kind: "approval",
      deviceFingerprint: input.deviceFingerprint,
    });
  }

  if (!input.sessionToken) {
    return err(orderError("session_required", "Session required.", 401));
  }

  const access = await assertGuestCanPlaceOrder(admin, {
    tableToken: input.tableToken,
    sessionToken: input.sessionToken,
    deviceFingerprint: input.deviceFingerprint,
    deviceToken: input.deviceToken,
    tablePin: input.tablePin,
  });

  if (!access.ok) {
    return err(sessionValidationError(access.error, access.status));
  }

  const sessionResult = await validateTableSession(
    admin,
    input.tableToken,
    input.sessionToken
  );

  if ("error" in sessionResult) {
    return err(
      sessionValidationError(sessionResult.error, sessionResult.status)
    );
  }

  return ok({
    kind: "normal",
    sessionId: sessionResult.data.session.id,
  });
}
