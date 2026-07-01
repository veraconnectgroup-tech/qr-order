import { withErrorHandler } from "@/lib/api/with-error-handler";
import { buildBelegHtml, type BelegData } from "@/lib/fiscal/beleg";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { withRateLimit } from "@/lib/rate-limit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound() {
  return new Response(null, { status: 404 });
}

export const GET = withErrorHandler("beleg-token-get", async (_req, ctx) => {
  const limited = await withRateLimit(_req, "default");
  if (limited) return limited;

  const { token } = await ctx.params;

  if (!UUID_RE.test(token)) {
    return notFound();
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("beleg_snapshot")
    .eq("beleg_token", token)
    .single();

  if (!order) {
    return notFound();
  }

  const snapshot = (order as { beleg_snapshot: Json | null }).beleg_snapshot;
  if (!snapshot || typeof snapshot !== "object") {
    return notFound();
  }

  const html = await buildBelegHtml(snapshot as BelegData);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
});
