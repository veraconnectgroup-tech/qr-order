import type { MenuSection } from "@/lib/menu-section";
import {
  calculateOrderTaxFromItems,
  resolveItemTaxRate,
} from "@/lib/tax/vat";

export type StaffCartLineInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
  productTaxRate: number | null;
  menuSection: MenuSection;
  notes?: string;
  modifiers: Array<{ modifierId: string; price: number }>;
};

export type StaffOrderSnapshotItem = {
  productId: string;
  quantity: number;
  lineTotal: number;
  taxRate: number;
  unitPrice: number;
  modifierTotal: number;
};

export type StaffOrderClientSnapshot = {
  subtotal: number;
  taxAmount: number;
  total: number;
  effectiveTaxPercent: number;
  items: StaffOrderSnapshotItem[];
};

export function computeStaffOrderTotals(params: {
  cartItems: StaffCartLineInput[];
  isTakeaway: boolean;
  orgDefaultRate: number;
}): StaffOrderClientSnapshot {
  const computedLines = params.cartItems.map((item) => {
    const modifierTotal = item.modifiers.reduce((sum, mod) => sum + mod.price, 0);
    const unitWithMods = item.unitPrice + modifierTotal;
    const lineTotal = unitWithMods * item.quantity;
    const taxRate = resolveItemTaxRate({
      productTaxRate: item.productTaxRate,
      menuSection: item.menuSection,
      isTakeaway: params.isTakeaway,
      orgDefaultRate: params.orgDefaultRate,
    });

    return {
      productId: item.productId,
      quantity: item.quantity,
      lineTotal,
      taxRate,
      unitPrice: item.unitPrice,
      modifierTotal,
    };
  });

  const taxResult = calculateOrderTaxFromItems(
    computedLines.map((line) => ({
      lineTotal: line.lineTotal,
      taxRate: line.taxRate,
    }))
  );

  return {
    subtotal: taxResult.subtotal,
    taxAmount: taxResult.taxAmount,
    total: taxResult.total,
    effectiveTaxPercent: taxResult.effectiveTaxPercent,
    items: computedLines,
  };
}

/** Server-side mirror of create-staff-order item validation totals (for parity tests). */
export function computeStaffOrderTotalsFromServerItems(params: {
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    modifiers: Array<{ price: number }>;
    menuSection: MenuSection;
    productTaxRate: number | null;
  }>;
  isTakeaway: boolean;
  orgDefaultRate: number;
}): StaffOrderClientSnapshot {
  return computeStaffOrderTotals({
    cartItems: params.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      productTaxRate: item.productTaxRate,
      menuSection: item.menuSection,
      modifiers: item.modifiers.map((mod, index) => ({
        modifierId: `mod-${index}`,
        price: mod.price,
      })),
    })),
    isTakeaway: params.isTakeaway,
    orgDefaultRate: params.orgDefaultRate,
  });
}
