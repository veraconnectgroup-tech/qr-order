import { describe, expect, it } from "vitest";
import {
  resolveDenisFallbackLevel,
  fallbackMessageForLevel,
  resolveFallbackLocale,
} from "@/components/guest/denis-fallback-messages";
import {
  resolveWelcomeCopy,
  DEFAULT_WELCOME_CHIPS,
} from "@/components/guest/denis-welcome";
import {
  buildStaffNotification,
  shouldDeliverStaffNotification,
  DEFAULT_NOTIFICATION_RULES,
  mapStaffProactiveAlertToNotificationType,
} from "@/lib/denis/notifications/staff-notifications";
import {
  buildConfigVersion,
  rollbackTargetVersion,
} from "@/lib/denis/config/config-versioning";

describe("denis welcome", () => {
  it("shows localized welcome for new guests", () => {
    const copy = resolveWelcomeCopy("sr");
    expect(copy.greeting).toContain("Denis");
    expect(DEFAULT_WELCOME_CHIPS).toHaveLength(3);
  });

  it("personalizes returning guest greeting", () => {
    const copy = resolveWelcomeCopy("en", {
      isReturning: true,
      guestName: "Ana",
    });
    expect(copy.greeting).toContain("Ana");
  });
});

describe("denis fallback", () => {
  it("resolves fallback level from circuit state", () => {
    expect(resolveDenisFallbackLevel({ circuitOpen: true })).toBe(3);
    expect(resolveDenisFallbackLevel({ circuitHalfOpen: true })).toBe(2);
    expect(resolveDenisFallbackLevel({ infrastructureDown: true })).toBe(4);
  });

  it("returns localized fallback messages", () => {
    expect(fallbackMessageForLevel(3, "sr")).toContain("odmara");
    expect(resolveFallbackLocale("hr")).toBe("hr");
  });
});

describe("config versioning", () => {
  it("builds diff and supports rollback", () => {
    const v1 = buildConfigVersion({
      id: "v1",
      locationId: "loc-1",
      version: 1,
      config: { persona: { maxWordsPerReply: 40 } },
      previousConfig: null,
      appliedAt: "2026-06-01T00:00:00.000Z",
      appliedBy: "owner-1",
    });

    const v2 = buildConfigVersion({
      id: "v2",
      locationId: "loc-1",
      version: 2,
      config: { persona: { maxWordsPerReply: 30 } },
      previousConfig: v1.config,
      appliedAt: "2026-06-02T00:00:00.000Z",
      appliedBy: "owner-1",
    });

    expect(v2.diff.entries.length).toBeGreaterThan(0);
    expect(rollbackTargetVersion([v1, v2], 2)?.version).toBe(1);
  });
});

describe("staff notifications", () => {
  it("delivers allergy alert to assigned waiter", () => {
    const notification = buildStaffNotification({
      type: "allergy_alert",
      tableName: "Table 7",
      message: "Guest mentioned peanut allergy",
    });
    expect(notification.priority).toBe("urgent");

    expect(
      shouldDeliverStaffNotification({
        rules: DEFAULT_NOTIFICATION_RULES,
        type: "allergy_alert",
        tableId: "t-7",
        assignedWaiterId: "waiter-1",
        recipientStaffId: "waiter-1",
      })
    ).toBe(true);
  });

  it("throttles duplicate table notifications within 5 minutes", () => {
    expect(
      shouldDeliverStaffNotification({
        rules: DEFAULT_NOTIFICATION_RULES,
        type: "long_wait",
        tableId: "t-7",
        recipientStaffId: "manager-1",
        lastTableNotificationAt: Date.now() - 60_000,
      })
    ).toBe(false);
  });

  it("maps session watcher alert kinds to notification types", () => {
    expect(mapStaffProactiveAlertToNotificationType("staff_allergy")).toBe(
      "allergy_alert"
    );
    expect(mapStaffProactiveAlertToNotificationType("staff_waiter_request")).toBe(
      "waiter_call"
    );
    expect(mapStaffProactiveAlertToNotificationType("staff_table_idle")).toBe(
      "long_wait"
    );
  });
});
