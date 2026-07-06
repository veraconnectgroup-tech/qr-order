import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { interpretStationVoiceTurn } from "@/lib/denis/stations/interpret-station-voice-turn";
import {
  appendStationQuestionTurn,
  listStationQuestionTurns,
} from "@/lib/denis/stations/station-question-turns";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const schema = z.object({
  questionId: z.string().uuid(),
  transcript: z.string().trim().max(2000),
});

/** Kitchen/bar — Denis understands a spoken staff reply and continues the conversation. */
export const POST = withErrorHandler(
  "denis-station-voice-turn-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

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
      .select(
        "id, location_id, station, message, question_type, status, order_id, table_id, order:orders(order_number, created_at), table:tables(name)"
      )
      .eq("id", parsed.data.questionId)
      .maybeSingle();

    if (!question) {
      return apiError("Question not found.", 404);
    }

    const questionRow = question as unknown as {
      id: string;
      location_id: string;
      station: "kitchen" | "bar";
      message: string;
      question_type:
        | "eta"
        | "pending_accept"
        | "ready_pickup"
        | "mixed_conflict";
      status: string;
      order_id: string | null;
      table_id: string | null;
      order:
        | { order_number: number | null; created_at: string }
        | { order_number: number | null; created_at: string }[]
        | null;
      table: { name: string } | { name: string }[] | null;
    };

    const orderRel = Array.isArray(questionRow.order)
      ? questionRow.order[0]
      : questionRow.order;
    const tableRel = Array.isArray(questionRow.table)
      ? questionRow.table[0]
      : questionRow.table;
    const waitMinutes =
      orderRel?.created_at != null
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - Date.parse(orderRel.created_at)) / 60_000
            )
          )
        : null;

    if (questionRow.status !== "open") {
      return apiError("Pitanje je već odgovoreno ili isteklo.", 409);
    }

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

    if (!isUuid(questionRow.location_id)) {
      return apiError("Invalid location.", 400);
    }

    const config = await loadConciergeConfigForLocation(questionRow.location_id);
    if (!config.surfaces.voiceStaffEnabled) {
      return apiError("Staff voice is not enabled for this location.", 403);
    }
    if (!config.ops.stationQuestions.enabled) {
      return apiError("Station questions are not enabled.", 403);
    }

    // config.ops.stationQuestions.meteredByCredits is an explicit decision,
    // default false — station voice is internal staff coordination, not
    // guest-billed AI usage (see the schema doc for the full reasoning).
    // No ai_credits gating call here by design.

    const priorTurns = await listStationQuestionTurns(
      admin,
      parsed.data.questionId
    );

    const turn = await interpretStationVoiceTurn(
      {
        questionMessage: questionRow.message,
        questionType: questionRow.question_type,
        station: questionRow.station,
        staffTranscript: parsed.data.transcript,
        priorTurns,
        tableName: tableRel?.name ?? null,
        orderNumber: orderRel?.order_number ?? null,
        waitMinutes,
      },
      config
    );

    await appendStationQuestionTurn(
      admin,
      parsed.data.questionId,
      "staff",
      parsed.data.transcript
    );
    if (turn.speak) {
      await appendStationQuestionTurn(
        admin,
        parsed.data.questionId,
        "denis",
        turn.speak
      );
    }

    return apiSuccess({ turn });
  }
);
