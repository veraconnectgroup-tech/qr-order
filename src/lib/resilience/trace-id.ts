export const TRACE_HEADER = "x-trace-id";

export function getTraceId(req: Request): string {
  const existing = req.headers.get(TRACE_HEADER);
  if (existing?.trim()) {
    return existing.trim();
  }
  return crypto.randomUUID();
}
