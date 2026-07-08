import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { isOpenAiConfigured } from "@/lib/ai/config";
import { AiOpenAiError } from "@/lib/ai/openai-client";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { listOwnerVoiceToolDefinitions } from "@/lib/denis/agentic/owner-voice-tool-catalog";
import { withStaffRateLimit } from "@/lib/rate-limit";

/** Same model/voice choice as the station-voice Realtime path — see that route's own note. */
const REALTIME_MODEL = "gpt-realtime-mini";
const REALTIME_VOICE = "alloy";
const REALTIME_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

const OWNER_VOICE_INSTRUCTIONS =
  "You are Denis, talking directly with the restaurant owner or manager — not a guest, not kitchen/bar staff. " +
  "They may ask how service is going, whether the kitchen is behind, or which tables need attention. " +
  "Always call get_venue_status before answering any question about current state — never guess or answer from a stale assumption. " +
  "If a tool call fails, say so honestly. Keep answers brief and direct, like a floor manager giving a quick verbal update. " +
  "Reply in Serbian unless the owner speaks another language first.";

/**
 * Owner/manager-facing Realtime voice conversation — mints an ephemeral
 * WebRTC token (same transport already proven in the station-voice
 * connectivity test) with venue-status tools configured server-side, so
 * the browser client can never inject its own tool definitions.
 * Read-only only: no side-effecting tools on this surface.
 */
export const POST = withErrorHandler(
  "denis-owner-voice-realtime-token-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await requireAdmin();
    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400);
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
          instructions: OWNER_VOICE_INSTRUCTIONS,
          tools: listOwnerVoiceToolDefinitions().map((tool) => ({
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
      locationId,
    });
  }
);
