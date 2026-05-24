export type PosOrderItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes: string | null;
  taxRate: number;
  modifiers: { name: string; price: number }[];
};

export type PosOrderPayload = {
  orderId: string;
  orderNumber: number;
  locationId: string;
  externalLocationId: string | null;
  tableName: string;
  total: number;
  currency: string;
  paymentState: "PAID" | "UNPAID";
  items: PosOrderItem[];
  createdAt: string;
};

export type PosDeliveryResult = {
  success: boolean;
  externalId?: string;
  error?: string;
  skipped?: boolean;
};

export type PosAdapter = {
  provider: string;
  pushOrder(
    payload: PosOrderPayload,
    config: Record<string, unknown>
  ): Promise<PosDeliveryResult>;
};
