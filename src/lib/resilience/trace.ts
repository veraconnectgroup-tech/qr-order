import * as Sentry from "@sentry/nextjs";

export { TRACE_HEADER, getTraceId } from "@/lib/resilience/trace-id";
export {
  getCurrentTraceId,
  runWithTraceId,
  runWithTraceIdAsync,
  traceMetadata,
} from "@/lib/resilience/trace-context";

export function applyTraceToSentry(traceId: string) {
  Sentry.setTag("trace_id", traceId);
  Sentry.addBreadcrumb({
    category: "trace",
    message: `trace_id=${traceId}`,
    level: "info",
  });
}
