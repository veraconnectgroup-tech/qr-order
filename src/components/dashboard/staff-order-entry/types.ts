import type { InPersonPaymentLocation } from "@/lib/constants";
import { type MenuSection } from "@/lib/menu-section";
import { resolveItemTaxRate } from "@/lib/tax/vat";
import type {
  Category,
  ProductWithModifiers,
  Table,
  Zone,
} from "@/types";

export type TableWithZone = Pick<Table, "id" | "name" | "location_id" | "zone_id"> & {
  zone: Pick<Zone, "name"> | null;
};

export type CategoryWithProducts = Category & {
  products: ProductWithModifiers[];
};

export type StaffCartModifier = {
  modifierId: string;
  modifierName: string;
  price: number;
};

export type StaffCartItem = {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string;
  modifiers: StaffCartModifier[];
  menuSection: MenuSection;
  productTaxRate: number | null;
  lineTotal: number;
};

export type PaymentMethodOption =
  | "at_bar"
  | "card_at_table"
  | "card_terminal"
  | "online";

export type LocationPaymentSettings = {
  accepting_orders: boolean;
  payment_online_enabled: boolean;
  payment_at_bar_enabled: boolean;
  payment_card_at_table_enabled: boolean;
};

export function productHasAvailableModifiers(product: ProductWithModifiers) {
  return (product.modifier_groups ?? []).some(
    (group) => group.modifiers.length > 0
  );
}

export function matchesStaffSearch(
  product: { name: string; name_en?: string | null },
  query: string
) {
  const q = query.toLowerCase();
  return (
    product.name.toLowerCase().includes(q) ||
    (product.name_en?.toLowerCase().includes(q) ?? false)
  );
}

export function atBarPaymentLabel(location: InPersonPaymentLocation) {
  switch (location) {
    case "counter":
      return "Pay at counter";
    case "table":
      return "Pay at table";
    default:
      return "Pay at bar";
  }
}

export function computeLineTotal(item: {
  unitPrice: number;
  quantity: number;
  modifiers: StaffCartModifier[];
}) {
  const mods = item.modifiers.reduce((sum, mod) => sum + mod.price, 0);
  return (item.unitPrice + mods) * item.quantity;
}

export function lineTotal(item: StaffCartItem) {
  return item.lineTotal;
}

export function cartItemTaxRate(
  item: StaffCartItem,
  isTakeaway: boolean,
  orgDefaultRate: number
) {
  return resolveItemTaxRate({
    productTaxRate: item.productTaxRate,
    menuSection: item.menuSection,
    isTakeaway,
    orgDefaultRate,
  });
}
