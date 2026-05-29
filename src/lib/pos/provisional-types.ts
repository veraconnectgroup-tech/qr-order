export type ProvisionalOrderItem = {
  productName: string;
  quantity: number;
  notes?: string;
};

export type ProvisionalOrderPayload = {
  clientOrderId: string;
  locationId: string;
  tableId: string;
  tableName: string;
  staffId: string;
  items: ProvisionalOrderItem[];
  total: number;
  createdAt: string;
};

export type PosBroadcastEvent =
  | { type: "provisional_order"; payload: ProvisionalOrderPayload }
  | {
      type: "order_confirmed";
      clientOrderId: string;
      orderId: string;
      orderNumber: number;
    }
  | { type: "order_conflict"; clientOrderId: string; reason: string };

export const POS_BROADCAST_EVENT = "pos_event" as const;

export const PROVISIONAL_KITCHEN_TIMEOUT_MS = 30_000;

export const posChannelName = (locationId: string) =>
  `pos:location:${locationId}`;
