import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MenuSection } from "@/lib/menu-section";
import {
  STANDARD_VAT_RATE,
  calculateOrderTaxFromItems,
  resolveItemTaxRate,
  type TaxBreakdownLine,
} from "@/lib/tax/vat";

export interface CartItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string;
  serveSize?: string | null;
  menuSection?: MenuSection;
  productTaxRate?: number | null;
  modifiers: Array<{
    modifierId: string;
    modifierName: string;
    price: number;
  }>;
  itemTotal: number;
}

interface CartStore {
  items: CartItem[];
  sessionToken: string | null;
  restaurantSlug: string | null;
  tableToken: string | null;
  tableName: string | null;
  cartBump: number;

  setSession: (
    slug: string,
    token: string,
    tableName: string,
    sessionToken: string
  ) => void;
  addItem: (item: Omit<CartItem, "itemTotal">) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;

  subtotal: () => number;
  taxBreakdown: (
    isTakeaway: boolean,
    orgDefaultRate?: number
  ) => TaxBreakdownLine[];
  taxAmount: (isTakeaway: boolean, orgDefaultRate?: number) => number;
  total: (isTakeaway: boolean, orgDefaultRate?: number) => number;
  itemCount: () => number;
}

function calcItemTotal(item: Omit<CartItem, "itemTotal">) {
  const modifierTotal = item.modifiers.reduce((s, m) => s + m.price, 0);
  return (item.unitPrice + modifierTotal) * item.quantity;
}

function cartTaxCalculation(
  items: CartItem[],
  isTakeaway: boolean,
  orgDefaultRate = STANDARD_VAT_RATE
) {
  return calculateOrderTaxFromItems(
    items.map((item) => ({
      lineTotal: item.itemTotal,
      taxRate: resolveItemTaxRate({
        productTaxRate: item.productTaxRate,
        menuSection: item.menuSection ?? "food",
        isTakeaway,
        orgDefaultRate,
      }),
    }))
  );
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      sessionToken: null,
      restaurantSlug: null,
      tableToken: null,
      tableName: null,
      cartBump: 0,

      setSession: (slug, token, tableName, sessionToken) =>
        set((state) => {
          const sameTable =
            state.restaurantSlug === slug && state.tableToken === token;
          const firstSession = !state.restaurantSlug && !state.tableToken;
          return {
            restaurantSlug: slug,
            tableToken: token,
            tableName,
            sessionToken,
            items: sameTable || firstSession ? state.items : [],
          };
        }),

      addItem: (item) => {
        const itemTotal = calcItemTotal(item);
        set((state) => ({
          items: [...state.items, { ...item, itemTotal }],
          cartBump: Date.now(),
        }));
      },

      removeItem: (index) =>
        set((state) => ({
          items: state.items.filter((_, i) => i !== index),
        })),

      updateQuantity: (index, quantity) =>
        set((state) => ({
          items: state.items.map((item, i) =>
            i === index
              ? {
                  ...item,
                  quantity,
                  itemTotal: calcItemTotal({ ...item, quantity }),
                }
              : item
          ),
        })),

      clearCart: () => set({ items: [] }),

      subtotal: () => get().items.reduce((sum, item) => sum + item.itemTotal, 0),
      taxBreakdown: (isTakeaway, orgDefaultRate) =>
        cartTaxCalculation(get().items, isTakeaway, orgDefaultRate).breakdown,
      taxAmount: (isTakeaway, orgDefaultRate) =>
        cartTaxCalculation(get().items, isTakeaway, orgDefaultRate).taxAmount,
      total: (isTakeaway, orgDefaultRate) =>
        cartTaxCalculation(get().items, isTakeaway, orgDefaultRate).total,
      itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    {
      name: "qr-order-cart",
      merge: (persisted, current) => {
        const saved = persisted as Partial<CartStore> | undefined;
        if (!saved) return current;
        const sameTable =
          saved.restaurantSlug === current.restaurantSlug &&
          saved.tableToken === current.tableToken;
        if (!sameTable) {
          const boundToCurrent =
            current.restaurantSlug != null && current.tableToken != null;
          if (boundToCurrent) {
            return { ...current, items: [] };
          }
          return { ...current, ...saved };
        }
        const items =
          current.items.length >= (saved.items?.length ?? 0)
            ? current.items
            : (saved.items ?? []);
        return { ...current, ...saved, items };
      },
    }
  )
);
