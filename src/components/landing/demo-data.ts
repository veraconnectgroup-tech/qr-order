import type { MenuCategory } from "@/components/guest/menu-grid";
import { getDemoProductMedia } from "@/lib/demo-product-media";
import type { CartItem } from "@/hooks/use-cart";
import type { OrderWithDetails, ProductWithModifiers } from "@/types";

const NOW = Date.now();

function minutesAgo(minutes: number) {
  return new Date(NOW - minutes * 60_000).toISOString();
}

function demoProduct(
  id: string,
  categoryId: string,
  name: string,
  price: number,
  description?: string,
  prepTime?: number
): ProductWithModifiers {
  const media = getDemoProductMedia(name);

  return {
    id,
    location_id: "demo-location",
    category_id: categoryId,
    name,
    name_en: null,
    description: description ?? null,
    description_en: null,
    price,
    image_url: media?.imageUrl ?? null,
    is_available: true,
    sort_order: 0,
    prep_time_minutes: prepTime ?? null,
    allergens: media?.allergens ?? null,
    tags: null,
    created_at: minutesAgo(60),
    updated_at: minutesAgo(60),
    modifier_groups: [],
  };
}

export const DEMO_CURRENCY = "EUR";
export const DEMO_TAX_PERCENT = 19;

export const DEMO_MENU_CATEGORIES: MenuCategory[] = [
  {
    id: "cat-cocktails",
    name: "Cocktails",
    products: [
      demoProduct(
        "p1",
        "cat-cocktails",
        "Aperol Spritz",
        9.5,
        "Prosecco, Aperol, soda",
        5
      ),
      demoProduct(
        "p2",
        "cat-cocktails",
        "Negroni",
        12,
        "Gin, Campari, vermouth",
        5
      ),
      demoProduct(
        "p3",
        "cat-cocktails",
        "Espresso Martini",
        13,
        "Vodka, Kahlúa, espresso",
        6
      ),
      demoProduct("p4", "cat-cocktails", "Hugo Spritz", 10, "Elderflower, mint", 4),
    ],
  },
  {
    id: "cat-food",
    name: "Food",
    products: [
      demoProduct("p5", "cat-food", "Truffle Fries", 8.5, "Parmesan, truffle oil", 12),
      demoProduct("p6", "cat-food", "Nachos", 11, "Guacamole, jalapeños", 10),
    ],
  },
];

export const DEMO_CART_ITEMS: CartItem[] = [
  {
    productId: "p1",
    productName: "Aperol Spritz",
    unitPrice: 9.5,
    quantity: 2,
    notes: "",
    modifiers: [],
    itemTotal: 19,
  },
  {
    productId: "p3",
    productName: "Espresso Martini",
    unitPrice: 13,
    quantity: 1,
    notes: "",
    modifiers: [{ modifierId: "m1", modifierName: "Extra shot", price: 1.5 }],
    itemTotal: 14.5,
  },
];

function demoOrder(
  id: string,
  orderNumber: number,
  status: OrderWithDetails["status"],
  tableName: string,
  zoneName: string | null,
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    modifiers?: string[];
  }>,
  total: number,
  createdMinutesAgo: number,
  paymentStatus: OrderWithDetails["payment_status"] = "paid"
): OrderWithDetails {
  const created_at = minutesAgo(createdMinutesAgo);

  return {
    id,
    location_id: "demo-location",
    table_id: "demo-table",
    session_id: null,
    order_number: orderNumber,
    status,
    subtotal: total / 1.19,
    tax_percent: 19,
    tax_amount: total - total / 1.19,
    total,
    stripe_payment_intent_id: null,
    payment_status: paymentStatus,
    notes: null,
    rejection_reason: null,
    estimated_prep_minutes: null,
    accepted_at: status !== "pending" ? minutesAgo(createdMinutesAgo - 1) : null,
    preparing_at:
      status === "preparing" || status === "ready" || status === "delivered"
        ? minutesAgo(createdMinutesAgo - 2)
        : null,
    ready_at:
      status === "ready" || status === "delivered"
        ? minutesAgo(createdMinutesAgo - 3)
        : null,
    delivered_at: status === "delivered" ? minutesAgo(1) : null,
    created_at,
    updated_at: created_at,
    order_items: items.map((item) => ({
      id: item.id,
      order_id: id,
      product_id: null,
      product_name: item.product_name,
      unit_price: item.unit_price,
      quantity: item.quantity,
      notes: null,
      total: item.unit_price * item.quantity,
      order_item_modifiers: (item.modifiers ?? []).map((name, i) => ({
        id: `${item.id}-mod-${i}`,
        order_item_id: item.id,
        modifier_id: null,
        modifier_name: name,
        price: 0,
      })),
    })),
    tables: { name: tableName, zone: zoneName ? { name: zoneName } : null },
  };
}

export const DEMO_ORDERS: OrderWithDetails[] = [
  demoOrder(
    "o1",
    47,
    "pending",
    "Table 8",
    "Rooftop",
    [
      { id: "oi1", product_name: "Aperol Spritz", quantity: 2, unit_price: 9.5 },
      { id: "oi2", product_name: "Hugo Spritz", quantity: 1, unit_price: 10 },
      { id: "oi3", product_name: "Espresso Martini", quantity: 1, unit_price: 13 },
    ],
    44.63,
    2
  ),
  demoOrder(
    "o2",
    46,
    "accepted",
    "VIP 2",
    "Lounge",
    [
      { id: "oi4", product_name: "Negroni", quantity: 2, unit_price: 12 },
      { id: "oi5", product_name: "Nachos", quantity: 1, unit_price: 11 },
    ],
    38.08,
    5
  ),
  demoOrder(
    "o3",
    45,
    "preparing",
    "Bar 1",
    null,
    [{ id: "oi6", product_name: "Espresso Martini", quantity: 2, unit_price: 13, modifiers: ["Extra shot"] }],
    34.51,
    8
  ),
  demoOrder(
    "o4",
    44,
    "ready",
    "Table 3",
    "Terrace",
    [{ id: "oi7", product_name: "Truffle Fries", quantity: 2, unit_price: 8.5 }],
    20.23,
    11
  ),
];

export const DEMO_KITCHEN_ORDERS = DEMO_ORDERS.filter((o) =>
  ["accepted", "preparing"].includes(o.status)
);

export const DEMO_TODAY_REVENUE = 51.78;

export type DemoTableStatus = "available" | "occupied" | "attention";

export type DemoTable = {
  id: string;
  name: string;
  seats: number;
  zoneId: string;
  zoneName: string;
  status: DemoTableStatus;
  sessionTotal?: number;
};

export const DEMO_ZONES = [
  { id: "z-bar", name: "Indoor Bar", count: 3 },
  { id: "z-roof", name: "Rooftop", count: 6 },
  { id: "z-vip", name: "VIP Lounge", count: 3 },
];

export const DEMO_TABLES: DemoTable[] = [
  { id: "t1", name: "Bar 1", seats: 2, zoneId: "z-bar", zoneName: "Indoor Bar", status: "available" },
  { id: "t2", name: "Bar 2", seats: 2, zoneId: "z-bar", zoneName: "Indoor Bar", status: "available" },
  { id: "t3", name: "Bar 3", seats: 2, zoneId: "z-bar", zoneName: "Indoor Bar", status: "available" },
  { id: "t4", name: "Table 5", seats: 4, zoneId: "z-roof", zoneName: "Rooftop", status: "available" },
  { id: "t5", name: "Table 6", seats: 4, zoneId: "z-roof", zoneName: "Rooftop", status: "available" },
  { id: "t6", name: "Table 7", seats: 4, zoneId: "z-roof", zoneName: "Rooftop", status: "available" },
  {
    id: "t7",
    name: "Table 8",
    seats: 4,
    zoneId: "z-roof",
    zoneName: "Rooftop",
    status: "attention",
  },
  { id: "t8", name: "Terrace 4", seats: 4, zoneId: "z-roof", zoneName: "Rooftop", status: "available" },
  {
    id: "t9",
    name: "Terrace 5",
    seats: 4,
    zoneId: "z-roof",
    zoneName: "Rooftop",
    status: "occupied",
    sessionTotal: 25.5,
  },
  { id: "t10", name: "VIP 1", seats: 6, zoneId: "z-vip", zoneName: "VIP Lounge", status: "occupied" },
  { id: "t11", name: "VIP 2", seats: 6, zoneId: "z-vip", zoneName: "VIP Lounge", status: "available" },
  { id: "t12", name: "VIP 3", seats: 6, zoneId: "z-vip", zoneName: "VIP Lounge", status: "available" },
];

export type DemoHistoryRow = {
  id: string;
  orderNumber: number;
  table: string;
  items: number;
  total: number;
  status: "pending" | "delivered";
  payment: "pending" | "counter";
  time: string;
};

export const DEMO_HISTORY_ROWS: DemoHistoryRow[] = [
  { id: "h4", orderNumber: 4, table: "Table 3", items: 6, total: 38.08, status: "pending", payment: "pending", time: "20:30" },
  { id: "h3", orderNumber: 3, table: "Table 8", items: 7, total: 44.63, status: "pending", payment: "pending", time: "20:21" },
  { id: "h2", orderNumber: 2, table: "Terrace 5", items: 4, total: 25.5, status: "delivered", payment: "counter", time: "20:20" },
  { id: "h1", orderNumber: 1, table: "Table 8", items: 1, total: 9.5, status: "delivered", payment: "counter", time: "20:20" },
];

export const DEMO_DASHBOARD_CONTEXT = {
  locationId: "demo-location",
  orgId: "demo-org",
  orgName: "Skyline Lounge",
  orgSlug: "skyline-lounge",
  currency: DEMO_CURRENCY,
  staffName: "Nica",
  staffRole: "owner",
  staffEmail: null,
  todayRevenue: DEMO_TODAY_REVENUE,
};
