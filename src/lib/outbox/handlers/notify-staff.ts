import { formatOrderNumber } from "@/lib/format";
import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";

export type NotifyStaffPayload = {
  orderId?: string;
  locationId?: string;
  orderNumber?: number;
  tableName?: string;
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

  const result = await notifyLocationPush(locationId, {
    title: `New order ${formatOrderNumber(orderNumber)}`,
    body: `Table ${tableName}`,
    url: "/dashboard/orders",
  });

  logger.info("Outbox fulfill.notify_staff delivered", {
    orderId: data.orderId,
    locationId,
    orderNumber,
    ...result,
  });
}
