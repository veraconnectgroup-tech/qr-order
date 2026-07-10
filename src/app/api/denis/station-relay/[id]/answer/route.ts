import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { answerRelayMessage } from "@/lib/denis/stations/station-relay-messages";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const schema = z.object({
  reply: z.string().trim().min(1).max(1000),
});

/** Staff's spoken reply to a Denis relay message, captured as free text. */
export const POST = withErrorHandler(
  "station-relay-answer-post",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { id } = await ctx.params;
    if (!isUuid(id)) {
      return apiError("Invalid relay id.", 400);
    }

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input", 400, parsed.error.flatten());
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiError("Unauthorized.", 401);
    }

    const { data: staff } = await supabase
      .from("staff")
      .select("id, org_id, location_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    const staffRow = staff as {
      id: string;
      org_id: string;
      location_id: string | null;
    };

    const admin = createAdminClient();
    const { data: relay } = await admin
      .from("denis_station_relay_messages")
      .select("id, location_id")
      .eq("id", id)
      .maybeSingle();

    if (!relay) {
      return apiError("Relay message not found.", 404);
    }

    const relayRow = relay as { id: string; location_id: string };

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", relayRow.location_id)
      .maybeSingle();

    if (
      !location ||
      (location as { org_id: string }).org_id !== staffRow.org_id ||
      (staffRow.location_id && staffRow.location_id !== relayRow.location_id)
    ) {
      return apiError("Unauthorized.", 401);
    }

    const result = await answerRelayMessage(admin, {
      relayId: relayRow.id,
      reply: parsed.data.reply,
      repliedByStaffId: staffRow.id,
    });

    if (!result.ok) {
      if (result.error === "not_open") {
        return apiError("Poruka je već odgovorena ili istekla.", 409);
      }
      return apiError("Odgovor nije mogao da se sačuva.", 500);
    }

    return apiSuccess({ relay: result.relay });
  }
);
