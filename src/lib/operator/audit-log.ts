import { getTraceId } from "@/lib/resilience/trace";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OperatorApiContext } from "@/lib/operator/auth";

export async function logOperatorApiRequest(input: {
  ctx: OperatorApiContext;
  req: Request;
  statusCode: number;
  startedAt: number;
  includePii?: boolean;
}): Promise<void> {
  const admin = createAdminClient();
  const url = new URL(input.req.url);

  await admin.from("operator_api_audit").insert({
    org_id: input.ctx.orgId,
    key_id: input.ctx.keyId,
    method: input.req.method,
    path: url.pathname,
    status_code: input.statusCode,
    latency_ms: Math.max(0, Date.now() - input.startedAt),
    trace_id: getTraceId(input.req),
    include_pii: input.includePii ?? false,
  });
}
