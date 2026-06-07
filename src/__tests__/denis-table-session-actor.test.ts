import { describe, expect, it } from "vitest";
import {
  signalResultToResponse,
} from "@/lib/denis/actor/table-session-actor";
import { actorDedupeKey, actorQueueKey } from "@/lib/denis/actor/redis-keys";
import { InMemoryTableSessionActor } from "@/lib/denis/eval/simulate-actor-fifo-queue";
import { resolveTableSessionActorEnabled } from "@/lib/denis/config/rollout";
import { TABLE_OS_PILOT_CONFIG_PATCH } from "@/lib/denis/config/pilot-wiring";
import { resolveConciergeConfig } from "@/lib/denis/config/merge-concierge-config";

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

  it("pilot rollout enables table session actor when Redis is ready", () => {
    const pilotConfig = resolveConciergeConfig({
      locationConfig: TABLE_OS_PILOT_CONFIG_PATCH,
    });
    expect(resolveTableSessionActorEnabled(pilotConfig, true)).toBe(true);
    expect(resolveTableSessionActorEnabled(pilotConfig, false)).toBe(false);
  });

  it("dedupes duplicate signalId in FIFO drain", async () => {
    const processed: string[] = [];
    const actor = new InMemoryTableSessionActor(async (item) => {
      processed.push(item.signalId);
    });
    const now = new Date().toISOString();

    actor.enqueue({
      signalId: "dedupe-once",
      kind: "guest",
      enqueuedAt: now,
    });
    actor.enqueue({
      signalId: "dedupe-once",
      kind: "guest",
      enqueuedAt: now,
    });

    await actor.drain();

    expect(processed).toEqual(["dedupe-once"]);
    expect(actor.getResults().skippedDuplicateSignalIds).toEqual(["dedupe-once"]);
  });
});
