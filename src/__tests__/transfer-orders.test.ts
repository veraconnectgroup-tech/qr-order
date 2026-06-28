import { beforeEach, describe, expect, it, vi } from "vitest";
import { mergeTableSessions } from "@/lib/tables/merge-split-table-sessions";
import * as transferModule from "@/lib/tables/transfer-orders";
import * as enqueueModule from "@/lib/scene/enqueue-scene-refresh";
import { scheduleTableTransferGuestNotification } from "@/lib/scene/schedule-table-transfer-scene-refresh";

describe("mergeTableSessions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(transferModule, "transferOrders").mockResolvedValue({
      data: {
        transferred: 2,
        orderIds: ["o1", "o2"],
        toTableName: "6",
        toSessionId: "sess-primary",
      },
    });
  });

  it("merges secondary table onto primary via full transfer", async () => {
    const result = await mergeTableSessions({
      primaryTableId: "primary",
      secondaryTableId: "secondary",
      staffId: "staff-1",
      locationId: "loc-1",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;

    expect(result.data).toMatchObject({
      transferred: 2,
      toTableName: "6",
      toSessionId: "sess-primary",
    });

    expect(transferModule.transferOrders).toHaveBeenCalledWith({
      fromTableId: "secondary",
      toTableId: "primary",
      orderIds: [],
      staffId: "staff-1",
      locationId: "loc-1",
      note: "merge: secondary session unified onto primary table",
    });
  });

  it("rejects merge when tables are identical", async () => {
    const result = await mergeTableSessions({
      primaryTableId: "same",
      secondaryTableId: "same",
      staffId: "staff-1",
      locationId: "loc-1",
    });

    expect(result).toMatchObject({
      error: "Primary and secondary table must differ.",
      status: 400,
    });
    expect(transferModule.transferOrders).not.toHaveBeenCalled();
  });
});

describe("scheduleTableTransferGuestNotification", () => {
  it("schedules transfer and split guest banners", async () => {
    const scheduleGuestSceneRefresh = vi
      .spyOn(enqueueModule, "scheduleGuestSceneRefresh")
      .mockResolvedValue(undefined);

    const admin = {} as never;
    await scheduleTableTransferGuestNotification(admin, {
      tableSessionId: "sess-1",
      toTableName: "7",
      kind: "transfer",
    });

    expect(scheduleGuestSceneRefresh).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        sessionId: "sess-1",
        proactiveBanner: expect.objectContaining({
          message: "Prebačeni ste na sto 7",
        }),
      })
    );

    await scheduleTableTransferGuestNotification(admin, {
      tableSessionId: "sess-2",
      toTableName: "7",
      kind: "split",
    });

    expect(scheduleGuestSceneRefresh).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        proactiveBanner: expect.objectContaining({
          message: "Podelili smo vaš sto. Svako ima svoj račun.",
        }),
      })
    );
  });
});
