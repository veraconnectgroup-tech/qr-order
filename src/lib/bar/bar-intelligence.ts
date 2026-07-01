import { getDrinksOrderItems } from "@/lib/kitchen/menu-section";
import { groupOrderItemsForDisplay } from "@/lib/orders/group-order-items-for-display";
import type { OrderWithDetails } from "@/types";
import {
  getCocktailRecipeCard,
  type CocktailRecipeCard,
} from "@/lib/bar/cocktail-recipes";

export type BarDrinkKind = "instant" | "cocktail" | "coffee";

export type BarQueueEntry = {
  order: OrderWithDetails;
  drinkKind: BarDrinkKind;
  targetPrepMinutes: number;
  priorityScore: number;
  priorityReasons: string[];
  foodWaitingBoost: boolean;
  cocktailCard: CocktailRecipeCard | null;
};

export type BarRoundGroup = {
  tableId: string;
  tableName: string;
  drinkKey: string;
  drinkLabel: string;
  totalQuantity: number;
  orderIds: string[];
  entries: BarQueueEntry[];
  summary: string;
};

export type BarRefillHint = {
  tableId: string;
  tableName: string;
  drinkName: string;
  minutesSinceDelivered: number;
  estimatedMinutesUntilRequest: number;
  message: string;
};

export type BarStatsSnapshot = {
  drinksLastHour: number;
  topCocktail: string | null;
  avgPrepMinutes: number | null;
};

const FOOD_WAITING_STATUSES = new Set([
  "pending_approval",
  "pending",
  "accepted",
  "preparing",
]);

const ACTIVE_BAR_STATUSES = new Set([
  "pending_approval",
  "pending",
  "accepted",
  "preparing",
  "ready",
]);

const COFFEE_PATTERN =
  /\b(coffee|kafa|espresso|latte|cappuccino|macchiato|flat white|americano)\b/i;
const COCKTAIL_PATTERN =
  /\b(cocktail|mojito|margarita|negroni|spritz|martini|daiquiri|cosmopolitan|old fashioned|aperol|whiskey sour|pina colada|mojito|gin tonic|g&t)\b/i;
const INSTANT_PATTERN =
  /\b(beer|pivo|pilsner|lager|weizen|wine|vino|sok|juice|cola|water|voda|lemonade|limunada|radler|sprite|fanta)\b/i;

export const BAR_REFILL_DELIVERED_MIN_MINUTES = 15;
export const BAR_REFILL_ESTIMATE_LEAD_MINUTES = 5;

function normalizeDrinkKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function classifyBarDrink(productName: string): {
  kind: BarDrinkKind;
  targetPrepMinutes: number;
} {
  const name = productName.trim();
  if (COFFEE_PATTERN.test(name)) {
    return { kind: "coffee", targetPrepMinutes: 2 };
  }
  if (COCKTAIL_PATTERN.test(name)) {
    return { kind: "cocktail", targetPrepMinutes: 4 };
  }
  if (INSTANT_PATTERN.test(name)) {
    return { kind: "instant", targetPrepMinutes: 0 };
  }
  return { kind: "instant", targetPrepMinutes: 0 };
}

function primaryDrinkLabel(order: OrderWithDetails): string {
  const drinks = groupOrderItemsForDisplay(getDrinksOrderItems(order));
  if (drinks.length === 0) return "Drink";
  if (drinks.length === 1) return drinks[0]!.product_name;
  return drinks.map((row) => `${row.quantity}× ${row.product_name}`).join(", ");
}

function dominantDrinkKind(order: OrderWithDetails): BarDrinkKind {
  const drinks = getDrinksOrderItems(order);
  if (drinks.length === 0) return "instant";
  let maxScore = -1;
  let kind: BarDrinkKind = "instant";
  for (const item of drinks) {
    const classified = classifyBarDrink(item.product_name);
    const score =
      classified.kind === "cocktail"
        ? 3
        : classified.kind === "coffee"
          ? 2
          : 1;
    if (score > maxScore) {
      maxScore = score;
      kind = classified.kind;
    }
  }
  return kind;
}

function targetPrepForOrder(order: OrderWithDetails): number {
  const drinks = getDrinksOrderItems(order);
  return Math.max(
    ...drinks.map((item) => classifyBarDrink(item.product_name).targetPrepMinutes),
    0
  );
}

function tableHasFoodWaiting(
  tableId: string | null,
  orders: OrderWithDetails[]
): boolean {
  if (!tableId) return false;
  return orders.some((order) => {
    if (order.table_id !== tableId) return false;
    if (!FOOD_WAITING_STATUSES.has(order.status)) return false;
    return (order.order_items ?? []).some((item) => item.menu_section === "food");
  });
}

function statusWeight(status: OrderWithDetails["status"]): number {
  switch (status) {
    case "pending_approval":
    case "pending":
      return 400;
    case "accepted":
      return 300;
    case "preparing":
      return 200;
    case "ready":
      return 100;
    default:
      return 0;
  }
}

function ageMinutes(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
}

/** Score bar queue entries — instant first, food-waiting boost, then age. */
export function prioritizeBarQueue(
  drinkOrders: OrderWithDetails[],
  allOrders: OrderWithDetails[],
  now = Date.now()
): BarQueueEntry[] {
  return drinkOrders
    .filter((order) => ACTIVE_BAR_STATUSES.has(order.status))
    .map((order) => {
      const drinkKind = dominantDrinkKind(order);
      const targetPrepMinutes = targetPrepForOrder(order);
      const foodWaitingBoost = tableHasFoodWaiting(order.table_id, allOrders);
      const priorityReasons: string[] = [];

      let priorityScore = statusWeight(order.status);
      priorityScore += ageMinutes(order.created_at, now) * 4;

      if (drinkKind === "instant") {
        priorityScore += 500;
        priorityReasons.push("instant");
      } else if (drinkKind === "coffee") {
        priorityScore += 250;
        priorityReasons.push("coffee ~2 min");
      } else {
        priorityScore += 150;
        priorityReasons.push("cocktail ~3-5 min");
      }

      if (foodWaitingBoost) {
        priorityScore += 800;
        priorityReasons.unshift("food waiting — drink first");
      }

      const cocktailCard =
        drinkKind === "cocktail" ? getCocktailRecipeCard(primaryDrinkLabel(order)) : null;

      return {
        order,
        drinkKind,
        targetPrepMinutes,
        priorityScore,
        priorityReasons,
        foodWaitingBoost,
        cocktailCard,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/** Group same-table same-drink orders into rounds (e.g. Sto 5: 4× Pilsner). */
export function groupBarDrinkRounds(entries: BarQueueEntry[]): BarRoundGroup[] {
  const buckets = new Map<string, BarRoundGroup>();

  for (const entry of entries) {
    const tableId = entry.order.table_id ?? entry.order.id;
    const tableName = entry.order.tables?.name ?? "—";
    for (const line of groupOrderItemsForDisplay(getDrinksOrderItems(entry.order))) {
      const drinkKey = normalizeDrinkKey(line.product_name);
      const bucketKey = `${tableId}:${drinkKey}`;
      const existing = buckets.get(bucketKey);
      if (existing) {
        existing.totalQuantity += line.quantity;
        if (!existing.orderIds.includes(entry.order.id)) {
          existing.orderIds.push(entry.order.id);
          existing.entries.push(entry);
        }
      } else {
        buckets.set(bucketKey, {
          tableId,
          tableName,
          drinkKey,
          drinkLabel: line.product_name,
          totalQuantity: line.quantity,
          orderIds: [entry.order.id],
          entries: [entry],
          summary: "",
        });
      }
    }
  }

  return [...buckets.values()]
    .filter((group) => group.totalQuantity >= 2 || group.entries.length >= 2)
    .map((group) => ({
      ...group,
      summary: `Sto ${group.tableName}: ${group.totalQuantity}× ${group.drinkLabel}`,
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity);
}

/** Bar-side refill prediction for delivered drinks without follow-up order. */
export function predictBarRefillHints(
  orders: OrderWithDetails[],
  now = Date.now()
): BarRefillHint[] {
  const hints: BarRefillHint[] = [];
  const openDrinkTables = new Set(
    orders
      .filter(
        (order) =>
          ACTIVE_BAR_STATUSES.has(order.status) &&
          getDrinksOrderItems(order).length > 0
      )
      .map((order) => order.table_id)
      .filter(Boolean) as string[]
  );

  const deliveredDrinks = orders.filter(
    (order) =>
      order.status === "delivered" &&
      getDrinksOrderItems(order).length > 0 &&
      order.table_id
  );

  for (const order of deliveredDrinks) {
    const tableId = order.table_id!;
    if (openDrinkTables.has(tableId)) continue;

    const deliveredRef = order.delivered_at ?? order.ready_at ?? order.created_at;
    const minutesSinceDelivered = ageMinutes(deliveredRef, now);
    if (minutesSinceDelivered < BAR_REFILL_DELIVERED_MIN_MINUTES) continue;

    const drinkName =
      groupOrderItemsForDisplay(getDrinksOrderItems(order))[0]?.product_name ??
      "piće";
    const estimatedMinutesUntilRequest = Math.max(
      0,
      BAR_REFILL_ESTIMATE_LEAD_MINUTES -
        Math.max(0, minutesSinceDelivered - BAR_REFILL_DELIVERED_MIN_MINUTES)
    );

    hints.push({
      tableId,
      tableName: order.tables?.name ?? "—",
      drinkName,
      minutesSinceDelivered,
      estimatedMinutesUntilRequest,
      message: `Sto ${order.tables?.name ?? "—"} — verovatno traži još ${drinkName} za ~${estimatedMinutesUntilRequest} min`,
    });
  }

  return hints
    .sort((a, b) => a.estimatedMinutesUntilRequest - b.estimatedMinutesUntilRequest)
    .slice(0, 6);
}

export function buildBarStatsSnapshot(
  orders: OrderWithDetails[],
  now = Date.now()
): BarStatsSnapshot {
  const hourAgo = now - 60 * 60_000;
  const recentDrinks = orders.filter((order) => {
    const ref = order.delivered_at ?? order.ready_at ?? order.created_at;
    return Date.parse(ref) >= hourAgo && getDrinksOrderItems(order).length > 0;
  });

  const cocktailCounts = new Map<string, number>();
  let drinksLastHour = 0;
  const prepSamples: number[] = [];

  for (const order of recentDrinks) {
    for (const item of getDrinksOrderItems(order)) {
      drinksLastHour += item.quantity;
      const kind = classifyBarDrink(item.product_name).kind;
      if (kind === "cocktail") {
        const key = normalizeDrinkKey(item.product_name);
        cocktailCounts.set(key, (cocktailCounts.get(key) ?? 0) + item.quantity);
      }
    }

    if (order.preparing_at && order.ready_at) {
      const prep = Math.round(
        (Date.parse(order.ready_at) - Date.parse(order.preparing_at)) / 60_000
      );
      if (prep >= 0) prepSamples.push(prep);
    }
  }

  const topCocktail =
    [...cocktailCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    drinksLastHour,
    topCocktail,
    avgPrepMinutes:
      prepSamples.length > 0
        ? Math.round(
            prepSamples.reduce((sum, value) => sum + value, 0) /
              prepSamples.length
          )
        : null,
  };
}

export function barPrepLabel(entry: BarQueueEntry): string {
  if (entry.drinkKind === "instant") return "ODMAH";
  if (entry.drinkKind === "coffee") return "~2 min";
  return "~3-5 min";
}
