import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import {
  executeOwnerVoiceTool,
  isOwnerVoiceToolName,
} from "@/lib/denis/agentic/owner-voice-tool-catalog";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  toolName: z.string().min(1).max(80),
  args: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Called by the browser client when the Realtime session (WebRTC, direct
 * to OpenAI) emits a function_call event — OpenAI never reaches our server
 * directly for tool execution on this transport, the client relays it here.
 * Re-validates tool name server-side; the session's own tool list
 * (realtime-token/route.ts) is what constrains what the model can ask for,
 * this is the second gate that actually runs it.
 */
export const POST = withErrorHandler(
  "denis-owner-voice-execute-tool-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await requireAdmin();
    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400);
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    if (!isOwnerVoiceToolName(parsed.data.toolName)) {
      return apiError("Unknown tool.", 400);
    }

    const admin = createAdminClient();
    const result = await executeOwnerVoiceTool(
      parsed.data.toolName,
      {
        admin,
        locationId,
        staffId: staff.id,
        staffRole: staff.role,
      },
      parsed.data.args ?? {}
    );

    return apiSuccess({ result });
  }
);
