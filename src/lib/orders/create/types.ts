import type { MenuSection } from "@/lib/menu-section";
import type { IdempotentOrderData } from "@/lib/orders/idempotency";
import type { CreateOrderInput } from "@/lib/orders/create/schema";

export type OrderSessionOpened = {
  sessionId: string;
  sessionToken: string;
  deviceToken: string;
  tablePin?: string;
};

export type OrderCreateMode =
  | { kind: "normal"; sessionId: string; sessionOpened?: OrderSessionOpened }
  | { kind: "approval"; deviceFingerprint: string }
  | { kind: "demo"; sessionId: string };

export type ResolvedContext = {
  table: {
    id: string;
    name: string;
    location_id: string;
    zone_id: string | null;
    assigned_staff_id: string | null;
  };
  location: {
    id: string;
    org_id: string;
    accepting_orders: boolean;
    ordering_enabled: boolean;
    payment_online_enabled: boolean;
    payment_at_bar_enabled: boolean;
    payment_card_at_table_enabled: boolean;
    require_first_table_approval: boolean;
  };
  org: {
    id: string;
    default_tax_percent: number;
    currency: string;
    stripe_onboarded: boolean;
    stripe_account_id: string | null;
  };
};

export type ValidatedLineItemModifier = {
  modifierId: string;
  modifierName: string;
  price: number;
};

export type ValidatedLineItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes: string;
  menuSection: MenuSection;
  productTaxRate: number | null;
  taxRate: number;
  modifiers: ValidatedLineItemModifier[];
  itemTotal: number;
};

export type OrderPricing = {
  subtotal: number;
  taxAmount: number;
  effectiveTaxPercent: number;
  discountAmount: number;
  finalTotal: number;
  promoCodeId: string | null;
};

export type OrderDraft = {
  context: ResolvedContext;
  lineItems: ValidatedLineItem[];
  pricing: OrderPricing;
  mode: OrderCreateMode;
  input: CreateOrderInput;
};

export type CreateOrderSuccess = {
  orderId: string;
  orderNumber: number;
  total: number;
  taxPercent: number;
  tableName: string;
  currency: string;
  orgId: string;
  locationId: string;
  awaitingApproval?: true;
  sessionOpened?: OrderSessionOpened;
};

export type CreateOrderResult =
  | { data: IdempotentOrderData; error?: never }
  | {
      data?: never;
      error: string;
      status: number;
      products?: string[];
      blockedUntil?: string;
    };
