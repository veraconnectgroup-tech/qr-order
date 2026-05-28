import { describe, expect, it } from "vitest";
import {
  signalResultToResponse,
} from "@/lib/denis/actor/table-session-actor";
import { actorDedupeKey, actorQueueKey } from "@/lib/denis/actor/redis-keys";

describe("Table Session Actor (Phase E)", () => {
  it("builds stable redis keys per session", () => {
    expect(actorQueueKey("sess-1")).toBe("denis:actor:queue:sess-1");
    expect(actorDedupeKey("sig-abc")).toBe("denis:actor:dedupe:sig-abc");
  });

  it("maps stored result to HTTP response", async () => {
    const response = signalResultToResponse({
      status: 200,
      body: { data: { ingested: true, signalId: "sig-1" } },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data?: { ingested?: boolean };
    };
    expect(json.data?.ingested).toBe(true);
  });

  it("returns 504 on signal timeout", async () => {
    const response = signalResultToResponse(null);
    expect(response.status).toBe(504);
  });
});
