import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { isOpenAiConfigured } from "@/lib/ai/config";
import { AiOpenAiError } from "@/lib/ai/openai-client";
import { assembleDenisBrainContext } from "@/lib/denis/cognition/context/assemble-denis-brain-context";
import { listStationGeneralVoiceToolDefinitions } from "@/lib/denis/agentic/station-general-voice-tool-catalog";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const schema = z.object({
  locationId: z.string().uuid(),
  station: z.enum(["kitchen", "bar"]),
});

/** Same model/voice choice as the other Realtime station-voice path. */
const REALTIME_MODEL = "gpt-realtime-mini";
const REALTIME_VOICE = "alloy";
const REALTIME_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

function buildStationGeneralVoiceInstructions(station: "kitchen" | "bar"): string {
  const stationLabel = station === "kitchen" ? "kuhinje" : "šanka";
  return [
    `You're talking with staff from the ${stationLabel} — they called YOU this time (not the other way around), so there's no specific pending question to resolve.`,
    "They may ask how service is going, whether the kitchen is behind, or which tables need attention.",
    "Always call get_venue_status before answering any question about current state — never guess or answer from a stale assumption.",
    "Keep answers brief and direct, like a colleague giving a quick verbal update.",
    "Speak Serbian — staff speak Serbian, don't switch language based on accent or background noise.",
  ].join("\n");
}

/**
 * Mints an ephemeral Realtime token for staff-initiated conversations
 * ("Pozovi Denisa" button) — distinct from station-voice/realtime-token,
 * which is Denis calling staff about one specific open station_questions
 * row. No question exists yet here, so instructions/tools are general
 * (read-only venue status) rather than question-resolution-focused.
 */
export const POST = withErrorHandler(
  "denis-station-voice-general-token-post",
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
      .select("id, org_id, location_id, role")
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
      role: string;
    };

    if (!isUuid(parsed.data.locationId)) {
      return apiError("Invalid location.", 400);
    }

    const admin = createAdminClient();
    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", parsed.data.locationId)
      .maybeSingle();

    if (
      !location ||
      (location as { org_id: string }).org_id !== staffRow.org_id ||
      (staffRow.location_id && staffRow.location_id !== parsed.data.locationId)
    ) {
      return apiError("Unauthorized.", 401);
    }

    const config = await loadConciergeConfigForLocation(parsed.data.locationId);
    if (!config.surfaces.voiceStaffEnabled) {
      return apiError("Staff voice is not enabled for this location.", 403);
    }

    if (!isOpenAiConfigured()) {
      return apiError("OpenAI is not configured.", 502);
    }

    const apiKey = process.env.OPENAI_API_KEY!.trim();
    const brainContext = await assembleDenisBrainContext(parsed.data.locationId);
    const instructions = [
      brainContext,
      "",
      buildStationGeneralVoiceInstructions(parsed.data.station),
    ].join("\n");

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
          instructions,
          tools: listStationGeneralVoiceToolDefinitions().map((tool) => ({
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
      locationId: parsed.data.locationId,
      station: parsed.data.station,
    });
  }
);
