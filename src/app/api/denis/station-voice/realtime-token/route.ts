import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { isOpenAiConfigured } from "@/lib/ai/config";
import { AiOpenAiError } from "@/lib/ai/openai-client";
import { resolveDenisVoiceInstructions } from "@/lib/ai/denis-voice-instructions";
import { listStationVoiceToolDefinitions } from "@/lib/denis/agentic/station-voice-realtime-tool-catalog";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { loadRestaurantKnowledgeBlock } from "@/lib/denis/knowledge/restaurant-knowledge-store";
import { loadStationVoiceSnapshot } from "@/lib/denis/venue/floor/load-station-voice-snapshot";
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

/** Same formula as resolveUrgencyRatio in denis-question-strip.tsx — kept server-side rather than importing a "use client" component. */
function resolveUrgencyRatio(askedAt: string, expiresAt: string, nowMs: number): number {
  const total = Date.parse(expiresAt) - Date.parse(askedAt);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(1, Math.max(0, (nowMs - Date.parse(askedAt)) / total));
}

function buildStationVoiceInstructions(input: {
  station: "kitchen" | "bar";
  message: string;
  urgencyRatio: number;
  venueChaosRatio: number;
  restaurantKnowledgeBlock: string | null;
}): string {
  const stationLabel = input.station === "kitchen" ? "kuhinjom" : "šankom";
  const persona = resolveDenisVoiceInstructions({
    urgencyRatio: input.urgencyRatio,
    venueChaosRatio: input.venueChaosRatio,
  });

  return [
    persona,
    "",
    "THIS CONVERSATION:",
    `You're talking live, over voice, with ${stationLabel} staff — a real back-and-forth, not a form to fill out. React naturally to what they actually say; a short acknowledgment before your next line reads as human, not robotic.`,
    `What you need from them: "${input.message}"`,
    "Call resolve_station_question the moment their answer is genuinely clear — never on a vague reply, ask one brief natural follow-up instead of guessing.",
    "If they start talking while you're mid-sentence, stop immediately and listen — don't talk over them.",
    "Speak Serbian — staff speak Serbian, don't switch language based on accent or background noise.",
    ...(input.restaurantKnowledgeBlock ? ["", input.restaurantKnowledgeBlock] : []),
  ].join("\n");
}

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
      .select("id, location_id, station, status, message, asked_at, expires_at")
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
      message: string;
      asked_at: string;
      expires_at: string;
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

    const [snapshot, restaurantKnowledgeBlock] = await Promise.all([
      loadStationVoiceSnapshot(admin, questionRow.location_id, questionRow.station),
      loadRestaurantKnowledgeBlock(questionRow.location_id),
    ]);
    const urgencyRatio = resolveUrgencyRatio(
      questionRow.asked_at,
      questionRow.expires_at,
      Date.now()
    );

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
          instructions: buildStationVoiceInstructions({
            station: questionRow.station,
            message: questionRow.message,
            urgencyRatio,
            venueChaosRatio: snapshot.venueChaosRatio,
            restaurantKnowledgeBlock,
          }),
          tools: listStationVoiceToolDefinitions().map((tool) => ({
            type: "function",
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
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
      questionId: questionRow.id,
      staffId: staffRow.id,
    });
  }
);
