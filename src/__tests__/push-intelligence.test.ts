import { describe, expect, it } from "vitest";
import {
  buildGuestDenisMessagePush,
  buildGuestOrderReadyPush,
  buildStaffPushEnvelope,
  formatGroupedPushMessage,
  isUrgentPushType,
  mapStaffNotificationToPushType,
  resolvePushSoundProfile,
  shouldBroadcastPushToAllStaff,
  shouldGroupPushType,
  shouldThrottleTablePush,
  TABLE_THROTTLE_SEC,
} from "@/lib/push/push-intelligence";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import { notifyGuestSessionPush } from "@/lib/push/notify-guest-session";
import { vi } from "vitest";

describe("push intelligence", () => {
  it("new order → ding sound profile", () => {
    expect(resolvePushSoundProfile("new-order")).toBe("ding");
  });

  it("waiter call → ring sound profile", () => {
    expect(resolvePushSoundProfile("waiter-call")).toBe("ring");
  });

  it("allergy → alarm + broadcast all staff", () => {
    expect(resolvePushSoundProfile("staff-allergy")).toBe("alarm");
    expect(
      shouldBroadcastPushToAllStaff({
        type: "staff-allergy",
        priority: "urgent",
      })
    ).toBe(true);
    expect(mapStaffNotificationToPushType("allergy_alert")).toBe("staff-allergy");
  });

  it("groups multiple new orders into one message", () => {
    const grouped = formatGroupedPushMessage("new-order", 3, "Sto 4");
    expect(grouped.body).toBe("3 nova ordera");
    expect(shouldGroupPushType("new-order")).toBe(true);
    expect(shouldGroupPushType("waiter-call")).toBe(false);
  });

  it("table throttle blocks repeat within 5 min", () => {
    expect(TABLE_THROTTLE_SEC).toBe(300);
    const now = Date.now();
    expect(shouldThrottleTablePush(now - 299_000, now)).toBe(true);
    expect(shouldThrottleTablePush(now - 301_000, now)).toBe(false);
  });

  it("normal staff alert routes to assigned waiter only", () => {
    const envelope = buildStaffPushEnvelope({
      pushType: "staff-alert",
      message: "Check table",
      tableName: "Sto 4",
      priority: "medium",
    });
    expect(envelope.broadcast).toBe(false);
  });

  it("urgent staff alert broadcasts to all", () => {
    const envelope = buildStaffPushEnvelope({
      pushType: "staff-urgent",
      message: "Kitchen delay",
      priority: "urgent",
    });
    expect(envelope.broadcast).toBe(true);
    expect(isUrgentPushType("staff-urgent")).toBe(true);
  });

  it("guest order ready copy", () => {
    const copy = buildGuestOrderReadyPush({ orderNumber: 47, language: "sr" });
    expect(copy.title).toMatch(/gotova/i);
    expect(copy.body).toContain("47");
  });

  it("guest Denis unread message copy", () => {
    const copy = buildGuestDenisMessagePush({
      preview: "Imam preporuku za vas",
      language: "sr",
    });
    expect(copy.title).toMatch(/Denis/i);
    expect(copy.body).toContain("preporuku");
  });
  it("new order staff envelope uses ding + non-broadcast routing", () => {
    const envelope = buildStaffPushEnvelope({
      pushType: "new-order",
      message: "Sto 8",
      tableName: "Sto 8",
      priority: "medium",
    });
    expect(envelope.soundProfile).toBe("ding");
    expect(envelope.type).toBe("new-order");
    expect(envelope.broadcast).toBe(false);
    expect(envelope.sound).toBe(true);
  });
});

describe("push dispatch wiring", () => {
  it("allergy dispatch uses urgent broadcast envelope", async () => {
    const pushModule = await import("@/lib/push/notify-location");
    const spy = vi.spyOn(pushModule, "notifyLocationPush").mockResolvedValue({
      sent: 2,
      failed: 0,
      removed: 0,
      targeted: 2,
    });

    await dispatchStaffNotification({
      locationId: "b0000000-0000-4000-8000-000000000001",
      type: "allergy_alert",
      message: "Guest reported peanut allergy",
      tableId: "t1",
      tableName: "Sto 3",
    });

    expect(spy).toHaveBeenCalledWith(
      "b0000000-0000-4000-8000-000000000001",
      expect.objectContaining({
        type: "staff-allergy",
        urgent: true,
        soundProfile: "alarm",
      }),
      expect.objectContaining({ broadcast: true })
    );

    spy.mockRestore();
  });

  it("guest order ready push uses guest-order-ready type", async () => {
    const admin = {
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                {
                  id: "sub1",
                  endpoint: "https://push.example/1",
                  p256dh: "key",
                  auth: "auth",
                },
              ],
            }),
        }),
      }),
    };

    const vapidModule = await import("@/lib/push/vapid");
    vi.spyOn(vapidModule, "isPushConfigured").mockReturnValue(true);
    const sendSpy = vi
      .spyOn(vapidModule, "sendPush")
      .mockResolvedValue({ ok: true });

    const result = await notifyGuestSessionPush(admin as never, {
      sessionId: "sess-1",
      pushType: "guest-order-ready",
      message: "fallback",
      orderNumber: 47,
      language: "sr",
    });

    expect(result.sent).toBe(1);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "guest-order-ready",
        soundProfile: "ding",
        title: expect.stringMatching(/gotova/i),
      })
    );

    sendSpy.mockRestore();
  });

  it("priority routing sends normal push only to assigned waiter", async () => {
    const pushModule = await import("@/lib/push/notify-location");
    const spy = vi.spyOn(pushModule, "notifyLocationPush").mockResolvedValue({
      sent: 1,
      failed: 0,
      removed: 0,
      targeted: 1,
    });

    await dispatchStaffNotification({
      locationId: "b0000000-0000-4000-8000-000000000001",
      type: "long_wait",
      message: "Guest waiting 18 min",
      tableId: "t2",
      tableName: "Sto 2",
      assignedWaiterId: "waiter-abc",
    });

    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "staff-alert" }),
      expect.objectContaining({
        assignedStaffId: "waiter-abc",
        broadcast: false,
      })
    );

    spy.mockRestore();
  });
});
