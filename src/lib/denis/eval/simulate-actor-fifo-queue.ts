/** Eval-only signal shape — mirrors `actor/types` without eval→actor import. */
export type EvalQueuedTableSessionSignal = {
  signalId: string;
  kind: "guest" | "world" | "experience";
  enqueuedAt: string;
  rawBody?: unknown;
};

export type ActorQueueProcessResult = {
  processedSignalIds: string[];
  skippedDuplicateSignalIds: string[];
};

type ProcessSignal = (
  item: EvalQueuedTableSessionSignal
) => Promise<void> | void;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * In-memory Table Session Actor — mirrors Redis FIFO + lock + signalId dedupe
 * for eval without live Redis (ADR-019 Phase E / M2).
 */
export class InMemoryTableSessionActor {
  private readonly queue: EvalQueuedTableSessionSignal[] = [];
  private readonly dedupe = new Set<string>();
  private readonly processedSignalIds: string[] = [];
  private readonly skippedDuplicateSignalIds: string[] = [];
  private lockHeld = false;
  private draining = false;

  constructor(private readonly processSignal: ProcessSignal) {}

  enqueue(item: EvalQueuedTableSessionSignal): void {
    this.queue.push(item);
  }

  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;

    while (true) {
      if (this.lockHeld) {
        await sleep(1);
        continue;
      }

      const item = this.queue.shift();
      if (!item) break;

      this.lockHeld = true;
      try {
        const isNew = !this.dedupe.has(item.signalId);
        if (!isNew) {
          this.skippedDuplicateSignalIds.push(item.signalId);
          continue;
        }

        this.dedupe.add(item.signalId);
        await this.processSignal(item);
        this.processedSignalIds.push(item.signalId);
      } finally {
        this.lockHeld = false;
      }
    }

    this.draining = false;
  }

  getResults(): ActorQueueProcessResult {
    return {
      processedSignalIds: [...this.processedSignalIds],
      skippedDuplicateSignalIds: [...this.skippedDuplicateSignalIds],
    };
  }
}

/** Simulate two phones racing on one table — returns final counter after FIFO drain. */
export async function simulateTwoPhoneRace(opts?: {
  workDelayMs?: number;
}): Promise<{
  counter: number;
  processedSignalIds: string[];
}> {
  let counter = 0;
  const actor = new InMemoryTableSessionActor(async () => {
    const snapshot = counter;
    await sleep(opts?.workDelayMs ?? 5);
    counter = snapshot + 1;
  });

  const now = new Date().toISOString();
  const sessionId = "sess-two-phone-race";

  const phoneA: EvalQueuedTableSessionSignal[] = [
    { signalId: "phone-a-add-cola", kind: "guest", enqueuedAt: now, rawBody: { sessionId } },
    { signalId: "phone-a-add-water", kind: "guest", enqueuedAt: now, rawBody: { sessionId } },
  ];
  const phoneB: EvalQueuedTableSessionSignal[] = [
    { signalId: "phone-b-add-pizza", kind: "guest", enqueuedAt: now, rawBody: { sessionId } },
    { signalId: "phone-b-add-salad", kind: "guest", enqueuedAt: now, rawBody: { sessionId } },
  ];

  await Promise.all([
    ...phoneA.map(async (item) => {
      actor.enqueue(item);
      await sleep(1);
    }),
    ...phoneB.map(async (item) => {
      actor.enqueue(item);
      await sleep(1);
    }),
  ]);

  await actor.drain();
  const { processedSignalIds } = actor.getResults();

  return { counter, processedSignalIds };
}
