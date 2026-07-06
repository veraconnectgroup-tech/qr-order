import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { isOpenAiConfigured } from "@/lib/ai/config";
import { AiOpenAiError } from "@/lib/ai/openai-client";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const schema = z.object({
  questionId: z.string().uuid(),
});

/** Realtime model — see resolve-station-voice-snapshot.ts / ADR notes for why mini over the full model by default. */
const REALTIME_MODEL = "gpt-realtime-mini";
/** Same brand voice as the existing TTS path (openai-tts.ts) — still valid on Realtime models. */
const REALTIME_VOICE = "alloy";
const REALTIME_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

/**
 * Mints a short-lived OpenAI Realtime client secret for a browser to
 * connect directly via WebRTC (per OpenAI's own guidance — WebRTC for
 * browser clients, not a server-mediated WebSocket). The real
 * OPENAI_API_KEY never leaves this server; only the ephemeral secret does.
 */
export const POST = withErrorHandler(
  "denis-station-voice-realtime-token-post",
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
      .select("id, location_id, station, status")
      .eq("id", parsed.data.questionId)
      .maybeSingle();

    if (!question) {
      return apiError("Question not found.", 404);
    }

    const questionRow = question as {
      id: string;
      location_id: string;
      station: "kitchen" | "bar";
      status: string;
    };

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
      (staffRow.location_id && staffRow.location_id !== questionRow.location_id)
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

    if (!isOpenAiConfigured()) {
      return apiError("OpenAI is not configured.", 502);
    }

    const apiKey = process.env.OPENAI_API_KEY!.trim();

    const res = await fetch(REALTIME_CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: REALTIME_MODEL,
          audio: { output: { voice: REALTIME_VOICE } },
        },
      }),
    });

    if (!res.ok) {
      let message = `OpenAI Realtime token request failed (${res.status})`;
      try {
        const errorBody = (await res.json()) as { error?: { message?: string } };
        if (errorBody.error?.message) message = errorBody.error.message;
      } catch {
        // ignore — keep default message
      }
      throw new AiOpenAiError(message, res.status);
    }

    const tokenBody = (await res.json()) as { value: string };

    return apiSuccess({
      clientSecret: tokenBody.value,
      station: questionRow.station,
    });
  }
);
