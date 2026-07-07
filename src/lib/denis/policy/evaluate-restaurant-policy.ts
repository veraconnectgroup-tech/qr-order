import type { RestaurantPolicy, RestaurantPolicyRuleId } from "./restaurant-policy.schema";

export const RESTAURANT_POLICY_DEBOUNCE_MINUTES = 10;

export type PolicyItemCategory = "drink" | "bar_cocktail" | "food" | "dessert" | "other";

/** A single order_events row relevant to policy evaluation — kept minimal for Evidence citation. */
export type PolicyOrderEventRef = {
  id: string;
  eventType: string;
  createdAt: string;
};

export type PolicyItemState = {
  itemId: string;
  itemName: string;
  category: PolicyItemCategory;
  orderedAt: string;
  servedAt: string | null;
  orderedEvent: PolicyOrderEventRef;
  servedEvent: PolicyOrderEventRef | null;
};

export type PolicyTableState = {
  tableId: string;
  tableName: string;
  orderId: string;
  isVip: boolean;
  items: PolicyItemState[];
};

export type RestaurantPolicyEvidence = {
  source: "order_events";
  orderId: string;
  eventId: string;
  eventType: string;
  observedAt: string;
  summary: string;
};

export type RestaurantPolicyAlert = {
  ruleId: RestaurantPolicyRuleId;
  tableId: string;
  tableName: string;
  orderId: string;
  triggeredAt: string;
  notify: RestaurantPolicy["notify"];
  evidence: RestaurantPolicyEvidence[];
  detail: Record<string, unknown>;
};

/** `${ruleId}:${tableId}` -> ISO timestamp of the last alert emitted for that rule+table. */
export type RestaurantPolicyDebounceState = Partial<Record<string, string>>;

export type EvaluateRestaurantPolicyInput = {
  policy: RestaurantPolicy;
  now: Date;
  tables: PolicyTableState[];
  debounceState?: RestaurantPolicyDebounceState;
};

function debounceKey(ruleId: RestaurantPolicyRuleId, tableId: string): string {
  return `${ruleId}:${tableId}`;
}

function isDebounced(
  ruleId: RestaurantPolicyRuleId,
  tableId: string,
  now: Date,
  debounceState: RestaurantPolicyDebounceState
): boolean {
  const lastAt = debounceState[debounceKey(ruleId, tableId)];
  if (!lastAt) return false;
  const elapsedMs = now.getTime() - Date.parse(lastAt);
  return elapsedMs < RESTAURANT_POLICY_DEBOUNCE_MINUTES * 60_000;
}

function minutesSince(iso: string, now: Date): number {
  return (now.getTime() - Date.parse(iso)) / 60_000;
}

function evidenceFromEvent(
  orderId: string,
  event: PolicyOrderEventRef,
  summary: string
): RestaurantPolicyEvidence {
  return {
    source: "order_events",
    orderId,
    eventId: event.id,
    eventType: event.eventType,
    observedAt: event.createdAt,
    summary,
  };
}

function evaluateServingOrder(
  policy: RestaurantPolicy,
  table: PolicyTableState
): RestaurantPolicyAlert | null {
  if (!policy.servingOrder.drinksBeforeFood || !policy.servingOrder.notifyIfBroken) {
    return null;
  }

  const servedDrinks = table.items.filter(
    (item) => item.category === "drink" && item.servedAt
  );
  const servedFood = table.items.filter((item) => item.category === "food" && item.servedAt);
  if (servedDrinks.length === 0 || servedFood.length === 0) return null;

  const earliestFood = servedFood.reduce((a, b) =>
    Date.parse(a.servedAt as string) < Date.parse(b.servedAt as string) ? a : b
  );
  const earliestDrink = servedDrinks.reduce((a, b) =>
    Date.parse(a.servedAt as string) < Date.parse(b.servedAt as string) ? a : b
  );

  if (Date.parse(earliestFood.servedAt as string) >= Date.parse(earliestDrink.servedAt as string)) {
    return null;
  }

  return {
    ruleId: "serving_order.drinks_before_food",
    tableId: table.tableId,
    tableName: table.tableName,
    orderId: table.orderId,
    triggeredAt: earliestDrink.servedAt as string,
    notify: policy.notify,
    evidence: [
      evidenceFromEvent(
        table.orderId,
        earliestFood.servedEvent as PolicyOrderEventRef,
        `${earliestFood.itemName} served ${earliestFood.servedAt}`
      ),
      evidenceFromEvent(
        table.orderId,
        earliestDrink.servedEvent as PolicyOrderEventRef,
        `${earliestDrink.itemName} served ${earliestDrink.servedAt}`
      ),
    ],
    detail: {
      foodItem: earliestFood.itemName,
      foodServedAt: earliestFood.servedAt,
      drinkItem: earliestDrink.itemName,
      drinkServedAt: earliestDrink.servedAt,
    },
  };
}

function evaluateMaxWait(
  ruleId: Extract<
    RestaurantPolicyRuleId,
    "max_wait.drinks" | "max_wait.food" | "max_wait.bar_cocktail" | "max_wait.vip"
  >,
  thresholdMinutes: number | null,
  category: PolicyItemCategory | null,
  policy: RestaurantPolicy,
  table: PolicyTableState,
  now: Date
): RestaurantPolicyAlert | null {
  if (thresholdMinutes == null) return null;

  const candidates = table.items.filter(
    (item) => !item.servedAt && (category == null || item.category === category)
  );
  const overdue = candidates.find((item) => minutesSince(item.orderedAt, now) > thresholdMinutes);
  if (!overdue) return null;

  const waitMinutes = minutesSince(overdue.orderedAt, now);

  return {
    ruleId,
    tableId: table.tableId,
    tableName: table.tableName,
    orderId: table.orderId,
    triggeredAt: now.toISOString(),
    notify: policy.notify,
    evidence: [
      evidenceFromEvent(
        table.orderId,
        overdue.orderedEvent,
        `${overdue.itemName} ordered ${overdue.orderedAt}, still not served`
      ),
    ],
    detail: {
      item: overdue.itemName,
      orderedAt: overdue.orderedAt,
      waitMinutes: Math.round(waitMinutes),
      thresholdMinutes,
    },
  };
}

function evaluateKitchenAskAfter(
  policy: RestaurantPolicy,
  table: PolicyTableState,
  now: Date
): RestaurantPolicyAlert | null {
  const thresholdMinutes = policy.kitchen.askAfterMinutes;
  if (thresholdMinutes == null) return null;

  const overdue = table.items.find(
    (item) =>
      item.category === "food" &&
      !item.servedAt &&
      minutesSince(item.orderedAt, now) > thresholdMinutes
  );
  if (!overdue) return null;

  return {
    ruleId: "kitchen.ask_after",
    tableId: table.tableId,
    tableName: table.tableName,
    orderId: table.orderId,
    triggeredAt: now.toISOString(),
    notify: policy.notify,
    evidence: [
      evidenceFromEvent(
        table.orderId,
        overdue.orderedEvent,
        `${overdue.itemName} ordered ${overdue.orderedAt}, no kitchen answer`
      ),
    ],
    detail: {
      item: overdue.itemName,
      orderedAt: overdue.orderedAt,
      thresholdMinutes,
    },
  };
}

function evaluateServeTogether(
  policy: RestaurantPolicy,
  table: PolicyTableState
): RestaurantPolicyAlert | null {
  if (!policy.service.serveTableTogether) return null;

  const served = table.items.filter((item) => item.servedAt);
  const unserved = table.items.filter((item) => !item.servedAt);
  if (served.length === 0 || unserved.length === 0) return null;

  const firstServed = served.reduce((a, b) =>
    Date.parse(a.servedAt as string) < Date.parse(b.servedAt as string) ? a : b
  );

  return {
    ruleId: "service.serve_together",
    tableId: table.tableId,
    tableName: table.tableName,
    orderId: table.orderId,
    triggeredAt: firstServed.servedAt as string,
    notify: policy.notify,
    evidence: [
      evidenceFromEvent(
        table.orderId,
        firstServed.servedEvent as PolicyOrderEventRef,
        `${firstServed.itemName} served ${firstServed.servedAt} while ${unserved.length} item(s) not ready`
      ),
    ],
    detail: {
      servedItem: firstServed.itemName,
      pendingItems: unserved.map((item) => item.itemName),
    },
  };
}

export function evaluateRestaurantPolicy(
  input: EvaluateRestaurantPolicyInput
): RestaurantPolicyAlert[] {
  const { policy, now, tables } = input;
  const debounceState = input.debounceState ?? {};
  const alerts: RestaurantPolicyAlert[] = [];

  for (const table of tables) {
    const candidates: Array<RestaurantPolicyAlert | null> = [
      evaluateServingOrder(policy, table),
      evaluateMaxWait(
        "max_wait.drinks",
        policy.maxWaitMinutes.drinks,
        "drink",
        policy,
        table,
        now
      ),
      evaluateMaxWait("max_wait.food", policy.maxWaitMinutes.food, "food", policy, table, now),
      evaluateMaxWait(
        "max_wait.bar_cocktail",
        policy.maxWaitMinutes.barCocktail,
        "bar_cocktail",
        policy,
        table,
        now
      ),
      policy.vip.enabled && policy.vip.notifyWaitExceeded && table.isVip
        ? evaluateMaxWait("max_wait.vip", policy.maxWaitMinutes.vip, null, policy, table, now)
        : null,
      evaluateKitchenAskAfter(policy, table, now),
      evaluateServeTogether(policy, table),
    ];

    for (const alert of candidates) {
      if (!alert) continue;
      if (isDebounced(alert.ruleId, alert.tableId, now, debounceState)) continue;
      alerts.push(alert);
    }
  }

  return alerts;
}

export function recordRestaurantPolicyAlert(
  debounceState: RestaurantPolicyDebounceState,
  alert: RestaurantPolicyAlert,
  emittedAt: Date
): RestaurantPolicyDebounceState {
  return {
    ...debounceState,
    [debounceKey(alert.ruleId, alert.tableId)]: emittedAt.toISOString(),
  };
}
