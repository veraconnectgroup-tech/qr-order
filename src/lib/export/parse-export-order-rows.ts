import type { DsfinvkOrderRow } from "@/lib/export/dsfinvk";

export type DatevOrderRow = {
  id: string;
  order_number: number;
  subtotal: number;
  total: number;
  tax_amount: number;
  tax_percent: number;
  payment_method: string;
  created_at: string;
  status: string;
  order_items: Array<{ total: number; tax_rate: number }>;
};

export function parseDatevOrderRows(data: unknown): DatevOrderRow[] {
  if (!Array.isArray(data)) return [];
  return data as DatevOrderRow[];
}

export function parseDsfinvkOrderRows(data: unknown): DsfinvkOrderRow[] {
  if (!Array.isArray(data)) return [];
  return data as DsfinvkOrderRow[];
}
