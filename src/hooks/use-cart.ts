import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MenuSection } from "@/lib/menu-section";
import type { OrderMode } from "@/lib/denis/commerce/delivery-mode";
import {
  STANDARD_VAT_RATE,
  calculateOrderTaxFromItems,
  resolveItemTaxRateForOrderMode,
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
  /** Per-line fulfillment for mixed dine-in / takeaway carts. */
  fulfillmentMode?: OrderMode;
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
  /** Product IDs removed this session — Denis must not re-offer them. */
  removedProductIds: string[];
  lastCartChangeAt: number;

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
  replaceItems: (items: CartItem[]) => void;
  setItemFulfillmentMode: (index: number, mode: OrderMode) => void;

  subtotal: () => number;
  taxBreakdown: (
    orderMode: OrderMode | boolean,
    orgDefaultRate?: number
  ) => TaxBreakdownLine[];
  taxAmount: (orderMode: OrderMode | boolean, orgDefaultRate?: number) => number;
  total: (orderMode: OrderMode | boolean, orgDefaultRate?: number) => number;
  itemCount: () => number;
}

function calcItemTotal(item: Omit<CartItem, "itemTotal">) {
  const modifierTotal = item.modifiers.reduce((s, m) => s + m.price, 0);
  return (item.unitPrice + modifierTotal) * item.quantity;
}

function cartTaxCalculation(
  items: CartItem[],
  orderMode: OrderMode | boolean,
  orgDefaultRate = STANDARD_VAT_RATE
) {
  const defaultMode: OrderMode =
    typeof orderMode === "boolean"
      ? orderMode
        ? "takeaway"
        : "dine_in"
      : orderMode;

  return calculateOrderTaxFromItems(
    items.map((item) => ({
      lineTotal: item.itemTotal,
      taxRate: resolveItemTaxRateForOrderMode({
        productTaxRate: item.productTaxRate,
        menuSection: item.menuSection ?? "food",
        orderMode: item.fulfillmentMode ?? defaultMode,
        orgDefaultRate,
      }),
    }))
  );
}

function bumpCartMutation<T extends Partial<CartStore>>(patch: T): T {
  return {
    ...patch,
    cartBump: Date.now(),
    lastCartChangeAt: Date.now(),
  };
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
      removedProductIds: [],
      lastCartChangeAt: 0,

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
            removedProductIds:
              sameTable || firstSession ? state.removedProductIds : [],
          };
        }),

      addItem: (item) => {
        const itemTotal = calcItemTotal(item);
        set((state) =>
          bumpCartMutation({
            items: [...state.items, { ...item, itemTotal }],
          })
        );
      },

      removeItem: (index) =>
        set((state) => {
          const removed = state.items[index];
          const removedProductIds = removed
            ? [...new Set([...state.removedProductIds, removed.productId])]
            : state.removedProductIds;
          return bumpCartMutation({
            items: state.items.filter((_, i) => i !== index),
            removedProductIds,
          });
        }),

      updateQuantity: (index, quantity) =>
        set((state) => {
          const existing = state.items[index];
          if (!existing) return state;
          if (quantity <= 0) {
            return bumpCartMutation({
              items: state.items.filter((_, i) => i !== index),
              removedProductIds: [
                ...new Set([...state.removedProductIds, existing.productId]),
              ],
            });
          }
          return bumpCartMutation({
            items: state.items.map((item, i) =>
              i === index
                ? {
                    ...item,
                    quantity,
                    itemTotal: calcItemTotal({ ...item, quantity }),
                  }
                : item
            ),
          });
        }),

      clearCart: () =>
        set({
          items: [],
          removedProductIds: [],
          cartBump: Date.now(),
          lastCartChangeAt: Date.now(),
        }),

      replaceItems: (items) =>
        set(
          bumpCartMutation({
            items,
          })
        ),

      setItemFulfillmentMode: (index, mode) =>
        set((state) => ({
          items: state.items.map((item, i) =>
            i === index ? { ...item, fulfillmentMode: mode } : item
          ),
        })),

      subtotal: () => get().items.reduce((sum, item) => sum + item.itemTotal, 0),
      taxBreakdown: (orderMode, orgDefaultRate) =>
        cartTaxCalculation(get().items, orderMode, orgDefaultRate).breakdown,
      taxAmount: (orderMode, orgDefaultRate) =>
        cartTaxCalculation(get().items, orderMode, orgDefaultRate).taxAmount,
      total: (orderMode, orgDefaultRate) =>
        cartTaxCalculation(get().items, orderMode, orgDefaultRate).total,
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
            return { ...current, items: [], removedProductIds: [] };
          }
          return { ...current, ...saved };
        }
        const items =
          current.items.length >= (saved.items?.length ?? 0)
            ? current.items
            : (saved.items ?? []);
        return {
          ...current,
          ...saved,
          items,
          removedProductIds: saved.removedProductIds ?? current.removedProductIds ?? [],
        };
      },
    }
  )
);
