import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string;
  serveSize?: string | null;
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
  taxAmount: (taxPercent: number) => number;
  total: (taxPercent: number) => number;
  itemCount: () => number;
}

function calcItemTotal(item: Omit<CartItem, "itemTotal">) {
  const modifierTotal = item.modifiers.reduce((s, m) => s + m.price, 0);
  return (item.unitPrice + modifierTotal) * item.quantity;
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
        set({
          restaurantSlug: slug,
          tableToken: token,
          tableName,
          sessionToken,
          items: [],
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
      taxAmount: (taxPercent) => get().subtotal() * (taxPercent / 100),
      total: (taxPercent) => get().subtotal() + get().taxAmount(taxPercent),
      itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: "qr-order-cart" }
  )
);
