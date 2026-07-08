import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  executeStationVoiceTool,
  isStationVoiceToolName,
} from "@/lib/denis/agentic/station-voice-realtime-tool-catalog";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const schema = z.object({
  toolName: z.string().min(1).max(80),
  questionId: z.string().uuid(),
  args: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Called by the browser client when the station-voice Realtime session
 * emits a function_call event (see realtime-tool-call-relay.ts). Re-derives
 * the staff identity and question ownership server-side rather than
 * trusting anything the client sends beyond the tool name/args — same
 * authorization shape as realtime-token/route.ts for this same surface.
 */
export const POST = withErrorHandler(
  "denis-station-voice-execute-tool-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    if (!isStationVoiceToolName(parsed.data.toolName)) {
      return apiError("Unknown tool.", 400);
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
      .select("id, location_id, status")
      .eq("id", parsed.data.questionId)
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
      (staffRow.location_id && staffRow.location_id !== questionRow.location_id)
    ) {
      return apiError("Unauthorized.", 401);
    }

    const result = await executeStationVoiceTool(admin, {
      questionId: questionRow.id,
      staffId: staffRow.id,
      args: parsed.data.args ?? {},
    });

    return apiSuccess({ result });
  }
);
