import type { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import {
  appendStationQuestionTurn,
  listStationQuestionTurns,
} from "@/lib/denis/stations/station-question-turns";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const appendSchema = z.object({
  questionId: z.string().uuid(),
  role: z.enum(["denis", "staff"]),
  text: z.string().trim().min(1).max(2000),
});

type AuthorizedQuestion = {
  admin: SupabaseClient;
  questionRow: {
    id: string;
    location_id: string;
    status: string;
  };
};

async function authorizeStaffForQuestion(
  questionId: string
): Promise<AuthorizedQuestion | NextResponse> {
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
    .select("id, location_id, status")
    .eq("id", questionId)
    .maybeSingle();

  if (!question) {
    return apiError("Question not found.", 404);
  }

  const questionRow = question as {
    id: string;
    location_id: string;
    status: string;
  };

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

  return { admin, questionRow };
}

function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof Response;
}

/** List persisted voice turns for a station question (survives refresh). */
export const GET = withErrorHandler(
  "denis-station-voice-turns-get",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const questionId = new URL(req.url).searchParams.get("questionId");
    if (!questionId || !isUuid(questionId)) {
      return apiError("Invalid questionId.", 400);
    }

    const auth = await authorizeStaffForQuestion(questionId);
    if (isNextResponse(auth)) return auth;

    const turns = await listStationQuestionTurns(auth.admin, questionId);
    return apiSuccess({ turns });
  }
);

/** Append one Denis or staff utterance to the conversation log. */
export const POST = withErrorHandler(
  "denis-station-voice-turns-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    const parsed = appendSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input", 400, parsed.error.flatten());
    }

    const auth = await authorizeStaffForQuestion(parsed.data.questionId);
    if (isNextResponse(auth)) return auth;

    if (auth.questionRow.status !== "open") {
      return apiError("Pitanje je već odgovoreno ili isteklo.", 409);
    }

    await appendStationQuestionTurn(
      auth.admin,
      parsed.data.questionId,
      parsed.data.role,
      parsed.data.text
    );

    return apiSuccess({ ok: true });
  }
);
