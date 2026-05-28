export function actorQueueKey(tableSessionId: string): string {
  return `denis:actor:queue:${tableSessionId}`;
}

export function actorLockKey(tableSessionId: string): string {
  return `denis:actor:lock:${tableSessionId}`;
}

export function actorDedupeKey(signalId: string): string {
  return `denis:actor:dedupe:${signalId}`;
}

export function actorResultKey(signalId: string): string {
  return `denis:actor:result:${signalId}`;
}

export function viewVersionKey(tableSessionId: string): string {
  return `denis:view:version:${tableSessionId}`;
}
