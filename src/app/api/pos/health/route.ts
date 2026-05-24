import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data: integrations } = await admin
    .from("pos_integrations")
    .select("id, provider, status, last_sync_at, last_error")
    .eq("status", "connected");

  const rows = (integrations ?? []) as Array<{
    id: string;
    provider: string;
    status: string;
    last_sync_at: string | null;
    last_error: string | null;
  }>;

  const { count: recentInbound } = await admin
    .from("pos_inbound_events" as never)
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return Response.json({
    ok: true,
    connectedIntegrations: rows.length,
    integrations: rows,
    inboundEventsLast24h: recentInbound ?? 0,
  });
}
