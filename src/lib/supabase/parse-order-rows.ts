import type { MenuSection } from "@/lib/menu-section";
import type { OrderWithDetails } from "@/types";
import { parseOrderWithDetails } from "@/lib/supabase/query-rows";

export type OrderFactQueryRow = {
  id: string;
  order_number: number | null;
  status: string;
  payment_status: string;
  estimated_prep_minutes: number | null;
  created_at: string;
  order_source?: string | null;
  order_items: Array<{
    id: string;
    product_id: string | null;
    product_name: string;
    quantity: number;
    total: number | string;
  }> | null;
};

export type AiGuestOrderQueryRow = {
  id: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  preparing_at?: string | null;
  estimated_prep_minutes?: number | null;
  prep_estimate_confidence?: "none" | "low" | "medium" | "high" | null;
  order_items: Array<{
    product_id: string | null;
    product_name: string;
    unit_price: number;
    quantity: number;
    menu_section: MenuSection;
  }> | null;
};

export type CheckoutOrderQueryRow = {
  id: string;
  total: number;
  payment_status: string;
  payment_method: string;
  stripe_payment_intent_id: string | null;
  location_id: string;
  status: string;
  table_id: string | null;
  tables: { name: string } | null;
};

export type ReorderOrderQueryRow = {
  id: string;
  session_id: string | null;
  order_items: Array<{
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    notes: string | null;
    tax_rate: number;
    menu_section: "drinks" | "food" | "desserts";
    order_item_modifiers: Array<{
      modifier_id: string | null;
      modifier_name: string;
      price: number;
    }>;
  }>;
};

export type DenisWorldSignalOrderRow = {
  order_number: number;
  location_id: string;
  session_id: string | null;
  tables: { id: string; qr_token: string };
};

export function parseOrderFactRows(data: unknown): OrderFactQueryRow[] {
  if (!Array.isArray(data)) return [];
  return data as OrderFactQueryRow[];
}

export function parseAiGuestOrderRows(data: unknown): AiGuestOrderQueryRow[] {
  if (!Array.isArray(data)) return [];
  return data as AiGuestOrderQueryRow[];
}

export function parseGuestOrderDetailRow(data: unknown): OrderWithDetails {
  return parseOrderWithDetails(data);
}

export function parseCheckoutOrderRow(data: unknown): CheckoutOrderQueryRow {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid checkout order row");
  }
  return data as CheckoutOrderQueryRow;
}

export function parseReorderOrderRow(data: unknown): ReorderOrderQueryRow {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid reorder order row");
  }
  return data as ReorderOrderQueryRow;
}

export function parseDenisWorldSignalOrderRow(
  data: unknown
): DenisWorldSignalOrderRow {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid Denis world signal order row");
  }
  return data as DenisWorldSignalOrderRow;
}
