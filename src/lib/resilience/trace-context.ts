import { AsyncLocalStorage } from "node:async_hooks";

const traceStorage = new AsyncLocalStorage<string>();

export function getCurrentTraceId(): string | undefined {
  return traceStorage.getStore();
}

export function runWithTraceId<T>(traceId: string, fn: () => T): T {
  return traceStorage.run(traceId, fn);
}

export async function runWithTraceIdAsync<T>(
  traceId: string,
  fn: () => Promise<T>
): Promise<T> {
  return traceStorage.run(traceId, fn);
}

export function traceMetadata(
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const traceId = getCurrentTraceId();
  if (!traceId) {
    return extra ?? {};
  }
  return { trace_id: traceId, ...extra };
}
