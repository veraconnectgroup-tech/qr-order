import {
  InMemoryTableSessionActor,
  simulateTwoPhoneRace,
  type EvalQueuedTableSessionSignal,
} from "@/lib/denis/eval/simulate-actor-fifo-queue";
import { resolveConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import { TABLE_OS_PILOT_CONFIG_PATCH } from "@/lib/denis/config/pilot-wiring";
import { resolveTableSessionActorEnabled } from "@/lib/denis/config/rollout";

export type ActorFifoFixtureResult = {
  passed: boolean;
  errors: string[];
};

function signal(
  signalId: string,
  enqueuedAt: string
): EvalQueuedTableSessionSignal {
  return {
    signalId,
    kind: "guest",
    enqueuedAt,
    rawBody: { text: signalId },
  };
}

/** Phase E / M2 — pilot rollout gate + FIFO order + signalId dedupe + 2-phone race. */
export async function runActorFifoFixture(): Promise<ActorFifoFixtureResult> {
  const errors: string[] = [];
  const now = "2026-06-07T12:00:00.000Z";

  const platformConfig = resolveConciergeConfig({});
  if (resolveTableSessionActorEnabled(platformConfig, true)) {
    errors.push("platform defaults must not enable table session actor");
  }

  const pilotConfig = resolveConciergeConfig({
    locationConfig: TABLE_OS_PILOT_CONFIG_PATCH,
  });
  if (!resolveTableSessionActorEnabled(pilotConfig, true)) {
    errors.push("table_os_pilot rollout must enable table session actor");
  }
  if (resolveTableSessionActorEnabled(pilotConfig, false)) {
    errors.push("table session actor must require Redis infra");
  }

  const processed: string[] = [];
  const actor = new InMemoryTableSessionActor(async (item) => {
    processed.push(item.signalId);
  });

  actor.enqueue(signal("sig-fifo-a", now));
  actor.enqueue(signal("sig-fifo-b", now));
  actor.enqueue(signal("sig-fifo-c", now));
  actor.enqueue(signal("sig-fifo-b", now));

  await actor.drain();

  if (
    processed.join(",") !== "sig-fifo-a,sig-fifo-b,sig-fifo-c"
  ) {
    errors.push(
      `FIFO order mismatch — expected sig-fifo-a,sig-fifo-b,sig-fifo-c got ${processed.join(",")}`
    );
  }

  const { skippedDuplicateSignalIds } = actor.getResults();
  if (skippedDuplicateSignalIds.length !== 1 || skippedDuplicateSignalIds[0] !== "sig-fifo-b") {
    errors.push(
      `signalId dedupe mismatch — expected one skipped sig-fifo-b, got ${skippedDuplicateSignalIds.join(",")}`
    );
  }

  return { passed: errors.length === 0, errors };
}

export async function runActorTwoPhoneRaceFixture(): Promise<ActorFifoFixtureResult> {
  const errors: string[] = [];
  const { counter, processedSignalIds } = await simulateTwoPhoneRace();

  if (processedSignalIds.length !== 4) {
    errors.push(
      `two-phone race expected 4 processed signals, got ${processedSignalIds.length}`
    );
  }

  if (counter !== 4) {
    errors.push(
      `two-phone race lost updates — expected counter 4 after FIFO, got ${counter}`
    );
  }

  return { passed: errors.length === 0, errors };
}

export async function runActorFifoEvalSuite(): Promise<ActorFifoFixtureResult> {
  const fifo = await runActorFifoFixture();
  const race = await runActorTwoPhoneRaceFixture();

  return {
    passed: fifo.passed && race.passed,
    errors: [...fifo.errors, ...race.errors],
  };
}
