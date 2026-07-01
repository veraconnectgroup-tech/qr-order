import { formatOrderNumber } from "@/lib/format";
import { logger } from "@/lib/logger";
import { scheduleNewOrderPush } from "@/lib/push/schedule-notify";

export type NotifyStaffPayload = {
  orderId?: string;
  locationId?: string;
  orderNumber?: number;
  tableName?: string;
  assignedStaffId?: string | null;
};

export async function handleFulfillNotifyStaff(
  payload: Record<string, unknown>
): Promise<void> {
  const data = payload as NotifyStaffPayload;
  const locationId = data.locationId;
  const orderNumber = data.orderNumber;
  const tableName = data.tableName ?? "Table";

  if (!locationId || orderNumber == null) {
    throw new Error("fulfill.notify_staff missing locationId or orderNumber");
  }

  scheduleNewOrderPush({
    locationId,
    orderNumber,
    tableName,
    assignedStaffId: data.assignedStaffId,
  });

  logger.info("Outbox fulfill.notify_staff delivered", {
    orderId: data.orderId,
    locationId,
    orderNumber,
  });
}
