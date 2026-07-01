import { getKitchenOrderItems } from "@/lib/kitchen/menu-section";
import type { OrderWithDetails } from "@/types";

export type KdsUrgency = "green" | "yellow" | "red";

export const KDS_URGENCY_RED_MINUTES = 10;
export const KDS_URGENCY_YELLOW_MINUTES = 5;
export const COURSE_PACING_HOLD_MS = 5 * 60_000;

export type KitchenCourse = "appetizer" | "main" | "dessert";

export type KitchenPrepBatch = {
  productName: string;
  totalQuantity: number;
  tableNames: string[];
  label: string;
};

export type KitchenAllergyBanner = {
  tableName: string;
  headline: string;
  detail: string | null;
};

const APPETIZER_PATTERN =
  /\b(salat|salad|soup|čorba|corba|supa|bruschetta|predjelo|appetizer|starter|tapas|cevap\s*salat)\b/i;

const ALLERGY_NOTE_PATTERN =
  /\b(bez\s*gluten\w*|gluten\s*free|glutenfrei|gf\b|alerg|allergy|allergen|intoleranc)/i;

const GLUTEN_FREE_PATTERN = /\b(bez\s*gluten\w*|gluten\s*free|glutenfrei|gf\b)/i;

function normalizeProductKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function kdsWaitMinutes(
  order: Pick<
    OrderWithDetails,
    "created_at" | "accepted_at" | "preparing_at"
  >,
  now = Date.now()
): number {
  const since =
    order.preparing_at ?? order.accepted_at ?? order.created_at;
  return Math.max(
    0,
    Math.floor((now - new Date(since).getTime()) / 60_000)
  );
}

export function kdsUrgencyForMinutes(minutes: number): KdsUrgency {
  if (minutes >= KDS_URGENCY_RED_MINUTES) return "red";
  if (minutes >= KDS_URGENCY_YELLOW_MINUTES) return "yellow";
  return "green";
}

export function kdsUrgencyForOrder(
  order: Pick<
    OrderWithDetails,
    "created_at" | "accepted_at" | "preparing_at"
  >,
  now = Date.now()
): KdsUrgency {
  return kdsUrgencyForMinutes(kdsWaitMinutes(order, now));
}

function urgencyRank(urgency: KdsUrgency): number {
  if (urgency === "red") return 3;
  if (urgency === "yellow") return 2;
  return 1;
}

/** Denis sorts kitchen queue — critical wait first, then oldest within tier. */
export function sortKitchenOrdersByUrgency<T extends Pick<
  OrderWithDetails,
  "created_at" | "accepted_at" | "preparing_at"
>>(
  orders: T[],
  now = Date.now()
): T[] {
  return [...orders].sort((a, b) => {
    const aMin = kdsWaitMinutes(a, now);
    const bMin = kdsWaitMinutes(b, now);
    const rankDiff =
      urgencyRank(kdsUrgencyForMinutes(bMin)) -
      urgencyRank(kdsUrgencyForMinutes(aMin));
    if (rankDiff !== 0) return rankDiff;
    const aSince = a.preparing_at ?? a.accepted_at ?? a.created_at;
    const bSince = b.preparing_at ?? b.accepted_at ?? b.created_at;
    return new Date(aSince).getTime() - new Date(bSince).getTime();
  });
}

export function classifyKitchenCourse(
  productName: string,
  menuSection: string | null | undefined
): KitchenCourse {
  if (menuSection === "desserts") return "dessert";
  if (menuSection === "food" && APPETIZER_PATTERN.test(productName)) {
    return "appetizer";
  }
  if (menuSection === "food") return "main";
  return "main";
}

function orderCourses(
  order: Pick<OrderWithDetails, "order_items">
): KitchenCourse[] {
  return getKitchenOrderItems(order).map((item) =>
    classifyKitchenCourse(item.product_name, item.menu_section)
  );
}

function isAppetizerOnlyOrder(order: Pick<OrderWithDetails, "order_items">): boolean {
  const courses = orderCourses(order);
  return courses.length > 0 && courses.every((c) => c === "appetizer");
}

function isMainCourseOrder(order: Pick<OrderWithDetails, "order_items">): boolean {
  const courses = orderCourses(order);
  return courses.length > 0 && courses.every((c) => c === "main");
}

/** Main course held until 5 min after appetizer delivered (course pacing). */
export function isOrderHeldForCoursePacing(
  order: OrderWithDetails,
  sessionOrders: OrderWithDetails[],
  now = Date.now()
): boolean {
  if (!isMainCourseOrder(order)) return false;
  if (order.status !== "accepted" && order.status !== "preparing") return false;
  if (!order.session_id) return false;

  const peers = sessionOrders.filter((row) => row.session_id === order.session_id);
  for (const peer of peers) {
    if (peer.id === order.id) continue;
    if (peer.status !== "delivered") continue;
    if (!isAppetizerOnlyOrder(peer)) continue;
    const deliveredAt = peer.delivered_at ?? peer.ready_at ?? peer.created_at;
    const elapsed = now - new Date(deliveredAt).getTime();
    if (elapsed >= 0 && elapsed < COURSE_PACING_HOLD_MS) {
      return true;
    }
  }
  return false;
}

export function coursePacingHoldMinutesRemaining(
  order: OrderWithDetails,
  sessionOrders: OrderWithDetails[],
  now = Date.now()
): number | null {
  if (!isOrderHeldForCoursePacing(order, sessionOrders, now)) return null;
  if (!order.session_id) return null;

  let latestAppetizerDelivered = 0;
  for (const peer of sessionOrders) {
    if (peer.session_id !== order.session_id) continue;
    if (peer.status !== "delivered" || !isAppetizerOnlyOrder(peer)) continue;
    const deliveredAt = peer.delivered_at ?? peer.ready_at ?? peer.created_at;
    latestAppetizerDelivered = Math.max(
      latestAppetizerDelivered,
      new Date(deliveredAt).getTime()
    );
  }
  if (latestAppetizerDelivered <= 0) return null;
  const remainingMs = COURSE_PACING_HOLD_MS - (now - latestAppetizerDelivered);
  return Math.max(1, Math.ceil(remainingMs / 60_000));
}

function collectAllergyText(
  order: Pick<OrderWithDetails, "notes" | "order_items">
): string | null {
  const chunks: string[] = [];
  if (order.notes?.trim()) chunks.push(order.notes.trim());
  for (const item of getKitchenOrderItems(order)) {
    if (item.notes?.trim()) chunks.push(item.notes.trim());
  }
  const joined = chunks.join(" | ");
  if (!joined) return null;
  if (!ALLERGY_NOTE_PATTERN.test(joined)) return null;
  return joined;
}

export function extractKitchenAllergyBanner(
  order: Pick<OrderWithDetails, "notes" | "order_items" | "tables">
): KitchenAllergyBanner | null {
  const allergyText = collectAllergyText(order);
  if (!allergyText) return null;

  const tableName = order.tables?.name?.trim() || "—";
  const glutenFree = GLUTEN_FREE_PATTERN.test(allergyText);

  if (glutenFree) {
    return {
      tableName,
      headline: `STO ${tableName}: BEZ GLUTENA`,
      detail: "koristiti GF hleb",
    };
  }

  return {
    tableName,
    headline: `STO ${tableName}: ALERGIJA`,
    detail: allergyText.slice(0, 120),
  };
}

/** Group identical kitchen items across tables for batch prep. */
export function buildKitchenPrepBatches(
  orders: OrderWithDetails[]
): KitchenPrepBatch[] {
  const map = new Map<
    string,
    { productName: string; totalQuantity: number; tableNames: Set<string> }
  >();

  for (const order of orders) {
    const tableName = order.tables?.name?.trim() || "—";
    for (const item of getKitchenOrderItems(order)) {
      const key = normalizeProductKey(item.product_name);
      const existing = map.get(key) ?? {
        productName: item.product_name.trim(),
        totalQuantity: 0,
        tableNames: new Set<string>(),
      };
      existing.totalQuantity += item.quantity;
      existing.tableNames.add(tableName);
      map.set(key, existing);
    }
  }

  return [...map.values()]
    .filter((row) => row.totalQuantity >= 2 && row.tableNames.size >= 1)
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .map((row) => {
      const tables = [...row.tableNames].sort((a, b) =>
        a.localeCompare(b, "sr")
      );
      const tablePart =
        tables.length === 1
          ? `sto ${tables[0]}`
          : `stolovi ${tables.join(", ")}`;
      return {
        productName: row.productName,
        totalQuantity: row.totalQuantity,
        tableNames: tables,
        label: `${row.totalQuantity}x ${row.productName} (${tablePart}) — pripremi zajedno`,
      };
    });
}

export function kdsUrgencyBorderClass(urgency: KdsUrgency): string {
  if (urgency === "red") return "border-red-500 animate-pulse";
  if (urgency === "yellow") return "border-amber-500";
  return "border-emerald-500/70";
}

export function kdsUrgencyTimerClass(urgency: KdsUrgency, light = false): string {
  if (urgency === "red") {
    return light ? "text-red-600" : "text-red-400";
  }
  if (urgency === "yellow") {
    return light ? "text-amber-600" : "text-amber-400";
  }
  return light ? "text-emerald-600" : "text-emerald-400";
}
