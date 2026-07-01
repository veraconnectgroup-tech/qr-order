/** W3 — Stock tracking intelligence (optional; falls back to manual unavailableProductIds). */

import type { StaffNotification } from "@/lib/denis/notifications/staff-notifications";
import { buildStaffNotification } from "@/lib/denis/notifications/staff-notifications";

export type ProductWithStock = {
  id: string;
  name: string;
  currentStock: number | null;
};

export type StockLevel = {
  productId: string;
  productName: string;
  currentStock: number | null;
  estimatedRunout: string | null;
  dailyAvgSold: number;
  status: "ok" | "low" | "critical" | "out";
};

export type InventoryAlert = {
  productId: string;
  productName: string;
  type: "running_low" | "will_run_out_today" | "just_ran_out";
  suggestion: string;
};

export type EvaluateInventoryInput = {
  products: ProductWithStock[];
  todayOrderCounts: Map<string, number>;
  historicalDailyAvg: Map<string, number>;
  currentHour: number;
  closingHour: number;
};

export function classifyStockStatus(
  stock: number | null,
  dailyAvg: number,
  soldToday = 0
): StockLevel["status"] {
  if (stock === null) return "ok";
  if (stock <= 0) return "out";
  if (soldToday >= stock) return "critical";
  if (dailyAvg <= 0) {
    return stock <= 3 ? "low" : "ok";
  }
  if (stock < dailyAvg) return "low";
  return "ok";
}

function estimateRunoutIso(
  stock: number,
  soldToday: number,
  dailyAvg: number,
  currentHour: number,
  closingHour: number
): string | null {
  const remainingHours = Math.max(0, closingHour - currentHour);
  if (remainingHours <= 0 || stock <= 0) return null;

  const elapsedHours = Math.max(1, currentHour);
  const ratePerHour = soldToday > 0 ? soldToday / elapsedHours : dailyAvg / 12;
  if (ratePerHour <= 0) return null;

  const hoursUntilEmpty = stock / ratePerHour;
  if (hoursUntilEmpty > remainingHours + 2) return null;

  const runoutMs = Date.now() + hoursUntilEmpty * 3_600_000;
  return new Date(runoutMs).toISOString();
}

export function formatPredictiveRunoutAlert(level: StockLevel): string | null {
  if (level.currentStock == null || level.currentStock <= 0) return null;
  if (level.status !== "critical" && level.status !== "low") return null;

  const runoutLabel = level.estimatedRunout
    ? new Date(level.estimatedRunout).toLocaleTimeString("sr-RS", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "kraja večeri";

  return `${level.productName} će nestati do ${runoutLabel} (ostalo ${level.currentStock}, dnevni prosek ${Math.round(level.dailyAvgSold)})`;
}

function buildAlert(
  level: StockLevel,
  remainingHours: number
): InventoryAlert | null {
  if (level.status === "out") {
    return {
      productId: level.productId,
      productName: level.productName,
      type: "just_ran_out",
      suggestion: `Označi ${level.productName} kao nedostupan i ponudi zamjenu gostima.`,
    };
  }

  if (level.status === "critical") {
    const predictive = formatPredictiveRunoutAlert(level);
    return {
      productId: level.productId,
      productName: level.productName,
      type: "will_run_out_today",
      suggestion:
        predictive ??
        `${level.productName}: ${level.currentStock} preostalo (~${Math.max(1, Math.round(remainingHours))}h do kraja) — pripremi zamjenu.`,
    };
  }

  if (level.status === "low") {
    return {
      productId: level.productId,
      productName: level.productName,
      type: "running_low",
      suggestion: `Naruči ${level.productName} za sutra — nisko stanje (${level.currentStock} preostalo).`,
    };
  }

  return null;
}

export function evaluateInventory(
  input: EvaluateInventoryInput
): { levels: StockLevel[]; alerts: InventoryAlert[] } {
  const remainingHours = Math.max(0, input.closingHour - input.currentHour);
  const levels: StockLevel[] = [];
  const alerts: InventoryAlert[] = [];

  for (const product of input.products) {
    const dailyAvg = input.historicalDailyAvg.get(product.id) ?? 0;
    const soldToday = input.todayOrderCounts.get(product.id) ?? 0;
    const status = classifyStockStatus(
      product.currentStock,
      dailyAvg,
      soldToday
    );

    const estimatedRunout =
      product.currentStock != null && product.currentStock > 0
        ? estimateRunoutIso(
            product.currentStock,
            soldToday,
            dailyAvg,
            input.currentHour,
            input.closingHour
          )
        : null;

    const level: StockLevel = {
      productId: product.id,
      productName: product.name,
      currentStock: product.currentStock,
      estimatedRunout,
      dailyAvgSold: dailyAvg,
      status,
    };
    levels.push(level);

    const alert = buildAlert(level, remainingHours);
    if (alert) alerts.push(alert);
  }

  return { levels, alerts };
}

/** Product IDs to auto-add to unavailableProductIds (stock = 0 only). */
export function autoUnavailableProductIds(levels: StockLevel[]): string[] {
  return levels
    .filter((level) => level.status === "out" && level.currentStock === 0)
    .map((level) => level.productId);
}

/** Format staff copilot stock briefing block. */
export function formatInventoryCopilotBrief(alerts: InventoryAlert[]): string {
  if (!alerts.length) return "";

  const lines = alerts.slice(0, 5).map((alert) => {
    if (alert.type === "will_run_out_today") {
      return `⚠️ ${alert.suggestion}`;
    }
    if (alert.type === "just_ran_out") {
      return `🛑 ${alert.productName}: rasprodato`;
    }
    return `📦 ${alert.suggestion}`;
  });

  return ["⚠️ STOCK ALERT:", ...lines].join("\n");
}

/** Guest-safe substitution hint — never reveals exact stock count. */
export function guestSubstitutionHint(
  productName: string,
  alternativeName: string
): string {
  return `${productName} je nažalost gotov. Imamo odličnu ${alternativeName}!`;
}

/** Map inventory alert → persisted staff notification (W3). */
export function inventoryAlertToStaffNotification(
  alert: InventoryAlert
): StaffNotification {
  const typeByAlert: Record<
    InventoryAlert["type"],
    StaffNotification["type"]
  > = {
    running_low: "inventory_running_low",
    will_run_out_today: "inventory_will_run_out",
    just_ran_out: "inventory_just_ran_out",
  };

  const priorityByAlert: Record<
    InventoryAlert["type"],
    StaffNotification["priority"]
  > = {
    running_low: "medium",
    will_run_out_today: "high",
    just_ran_out: "urgent",
  };

  return buildStaffNotification({
    type: typeByAlert[alert.type],
    priority: priorityByAlert[alert.type],
    message: alert.suggestion,
    actionUrl: "/admin/menu",
  });
}

/** Morning kitchen prep replenishment lines. */
export function formatMorningPrepReplenishment(
  alerts: InventoryAlert[]
): string[] {
  return alerts
    .filter(
      (alert) =>
        alert.type === "running_low" || alert.type === "will_run_out_today"
    )
    .map((alert) => alert.suggestion)
    .slice(0, 5);
}

const PROACTIVE_PRODUCT_NUDGE_KINDS = [
  "dessert_nudge",
  "popularity_pair",
  "happy_hour_upsell",
  "round_two",
  "drink_pairing",
  "drink_with_food",
] as const;

/** Skip proactive upsell nudges that reference an unavailable product name. */
export function shouldSkipProactiveForUnavailableProduct(input: {
  nudgeKind: string;
  message: string;
  unavailableProductNames: string[];
}): boolean {
  if (
    !PROACTIVE_PRODUCT_NUDGE_KINDS.includes(
      input.nudgeKind as (typeof PROACTIVE_PRODUCT_NUDGE_KINDS)[number]
    )
  ) {
    return false;
  }
  if (input.unavailableProductNames.length === 0) return false;

  const message = input.message.toLowerCase();
  return input.unavailableProductNames.some((name) => {
    const trimmed = name.trim().toLowerCase();
    return trimmed.length > 2 && message.includes(trimmed);
  });
}
