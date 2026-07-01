import { enqueue } from "@/lib/queue/client";

function delaySecondsUntil(iso: string, nowMs = Date.now()): number {
  const target = new Date(iso).getTime();
  const deltaMs = target - nowMs;
  if (deltaMs <= 0) return 0;
  return Math.ceil(deltaMs / 1000);
}

/** Schedule QStash jobs for kitchen release and no-show cancel (P3). */
export async function schedulePreorderJobs(input: {
  preorderId: string;
  kitchenReleaseAt: string;
  noShowCancelAt: string;
  nowMs?: number;
}): Promise<void> {
  const nowMs = input.nowMs ?? Date.now();
  const releaseDelay = delaySecondsUntil(input.kitchenReleaseAt, nowMs);
  const cancelDelay = delaySecondsUntil(input.noShowCancelAt, nowMs);

  await enqueue(
    "/api/jobs/preorder-release",
    { preorderId: input.preorderId, kind: "release" },
    { delay: releaseDelay, retries: 3 }
  );

  await enqueue(
    "/api/jobs/preorder-release",
    { preorderId: input.preorderId, kind: "cancel_no_show" },
    { delay: cancelDelay, retries: 3 }
  );
}
