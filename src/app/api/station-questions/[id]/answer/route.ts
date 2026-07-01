import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { answerStationQuestion } from "@/lib/denis/stations/station-questions";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const schema = z.object({
  answer: z.enum([
    "eta",
    "ready",
    "problem",
    "accepted",
    "picked_up",
    "still_waiting",
  ]),
  etaMinutes: z.number().int().min(1).max(120).optional(),
});

/** One-tap KDS/bar answer to a Denis question card. */
export const POST = withErrorHandler(
  "station-questions-answer-post",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { id } = await ctx.params;
    if (!isUuid(id)) {
      return apiError("Invalid question id.", 400);
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
    const { data: question } = await admin
      .from("station_questions")
      .select("id, location_id")
      .eq("id", id)
      .maybeSingle();

    if (!question) {
      return apiError("Question not found.", 404);
    }

    const questionRow = question as { id: string; location_id: string };

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", questionRow.location_id)
      .maybeSingle();

    if (
      !location ||
      (location as { org_id: string }).org_id !== staffRow.org_id ||
      (staffRow.location_id &&
        staffRow.location_id !== questionRow.location_id)
    ) {
      return apiError("Unauthorized.", 401);
    }

    const result = await answerStationQuestion(admin, {
      questionId: questionRow.id,
      answer: parsed.data.answer,
      etaMinutes: parsed.data.etaMinutes ?? null,
      staffId: staffRow.id,
    });

    if (!result.ok) {
      if (result.error === "not_open") {
        return apiError("Pitanje je već odgovoreno ili isteklo.", 409);
      }
      if (result.error === "invalid_eta") {
        return apiError("ETA minutes required for eta answer.", 400);
      }
      return apiError("Odgovor nije mogao da se sačuva.", 500);
    }

    return apiSuccess({ question: result.question });
  }
);
