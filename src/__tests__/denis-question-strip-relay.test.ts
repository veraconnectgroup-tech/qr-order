import { describe, expect, it } from "vitest";
import { buildRelayReplyDeliveryLine } from "@/components/stations/denis-question-strip";

describe("buildRelayReplyDeliveryLine", () => {
  it("names the station that answered (to_station), not the asker", () => {
    // The row's from_station always equals the current station in the
    // real query this feeds from (listUndeliveredRepliesForStation
    // filters on from_station=currentStation) — this locks in that the
    // label must come from to_station, the regression this test guards.
    expect(
      buildRelayReplyDeliveryLine({ to_station: "bar", reply: "Nosim odmah" })
    ).toBe("Odgovor stigao od Bar: Nosim odmah");
  });

  it("labels the kitchen when kitchen answered", () => {
    expect(
      buildRelayReplyDeliveryLine({ to_station: "kitchen", reply: "5 minuta" })
    ).toBe("Odgovor stigao od Kuhinja: 5 minuta");
  });

  it("falls back to an empty reply rather than throwing on a null reply", () => {
    expect(
      buildRelayReplyDeliveryLine({ to_station: "bar", reply: null })
    ).toBe("Odgovor stigao od Bar: ");
  });
});
