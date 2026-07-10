import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { isOpenAiConfigured } from "@/lib/ai/config";
import { AiOpenAiError } from "@/lib/ai/openai-client";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { assembleDenisBrainContext } from "@/lib/denis/cognition/context/assemble-denis-brain-context";
import { listOwnerVoiceToolDefinitions } from "@/lib/denis/agentic/owner-voice-tool-catalog";
import { withStaffRateLimit } from "@/lib/rate-limit";

/** Same model/voice choice as the station-voice Realtime path — see that route's own note. */
const REALTIME_MODEL = "gpt-realtime-mini";
/** Denis is male; echo reads as male across OpenAI's voice set (alloy reads closer to neutral/female). */
const REALTIME_VOICE = "echo";
const REALTIME_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

/**
 * Identity + restaurant knowledge come from assembleDenisBrainContext —
 * this used to be a separate hand-written description, which meant a
 * persona update elsewhere would silently never reach the owner. One
 * brain, not a parallel one per surface.
 */
const OWNER_VOICE_CONTEXT =
  "You're talking directly with the restaurant owner or manager — not a guest, not kitchen/bar staff. " +
  "They may ask how service is going, whether the kitchen is behind, or which tables need attention. " +
  "Always call get_venue_status before answering any question about current state — never guess or answer from a stale assumption. " +
  "If they tell you something to remember permanently — a rule, a standing fact about the restaurant — call remember_restaurant_knowledge and confirm back in one short sentence what you saved. " +
  "Before asking the owner to repeat something, check the restaurant knowledge context you've already been given — they may have already told you. " +
  // Explicit formality register, distinct from how he talks to kitchen/bar
  // staff (informal "ti") — the manager gets formal "vi" by default, same
  // as a guest, unless she's told him otherwise. If she says something
  // like "zovi me na ti", call remember_restaurant_knowledge so it's
  // durable across future calls, not just this one.
  "Address them formally (\"vi\"), the same register as a guest — unless they've told you to use \"ti\" instead, in which case check what you've already been told before defaulting back to formal. If they tell you to switch registers, call remember_restaurant_knowledge so you remember it next time too. " +
  "If a tool call fails, say so honestly. Keep answers brief and direct, like a floor manager giving a quick verbal update. " +
  "Reply in Serbian unless the owner speaks another language first.";

/**
 * Owner/manager-facing Realtime voice conversation — mints an ephemeral
 * WebRTC token (same transport already proven in the station-voice
 * connectivity test) with tools configured server-side, so the browser
 * client can never inject its own tool definitions. One side-effecting
 * tool (remember_restaurant_knowledge) — everything else is read-only.
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
    const brainContext = await assembleDenisBrainContext(locationId);
    const instructions = [brainContext, "", OWNER_VOICE_CONTEXT].join("\n");

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
