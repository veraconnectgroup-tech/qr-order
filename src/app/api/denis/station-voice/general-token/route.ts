import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { isOpenAiConfigured } from "@/lib/ai/config";
import { AiOpenAiError } from "@/lib/ai/openai-client";
import { assembleDenisBrainContext } from "@/lib/denis/cognition/context/assemble-denis-brain-context";
import { listStationGeneralVoiceToolDefinitions } from "@/lib/denis/agentic/station-general-voice-tool-catalog";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import {
  listDueCommitments,
  type DenisCommitmentRow,
} from "@/lib/denis/stations/denis-commitments";
import {
  listRecentActivity,
  type DenisActivityLogRow,
} from "@/lib/denis/stations/denis-activity-log";
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
/** Denis is male; echo reads as male across OpenAI's voice set (alloy reads closer to neutral/female). */
const REALTIME_VOICE = "echo";
const REALTIME_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

function buildDueCommitmentsBlock(
  today: string,
  commitments: DenisCommitmentRow[]
): string | null {
  if (commitments.length === 0) return null;
  const lines = commitments.map((c) => {
    const overdue = c.due_date < today ? " (OVERDUE)" : "";
    return `- [${c.id}] due ${c.due_date}${overdue}: ${c.text}`;
  });
  return [
    "THINGS YOU PREVIOUSLY PROMISED THAT ARE DUE NOW:",
    ...lines,
    "Bring these up yourself early in this conversation if they're relevant to who you're talking to — don't wait to be asked whether you remembered. Call complete_commitment once you've actually handled one.",
  ].join("\n");
}

function buildRecentActivityBlock(activity: DenisActivityLogRow[]): string | null {
  if (activity.length === 0) return null;
  const lines = activity.map((row) => `- ${row.summary}`);
  return [
    "WHAT YOU'VE ACTUALLY BEEN DOING TODAY (last few hours):",
    ...lines,
    "Use this to stay consistent — don't repeat something you already did, and reference it naturally if it's relevant to what's being asked now.",
  ].join("\n");
}

function buildStationGeneralVoiceInstructions(input: {
  station: "kitchen" | "bar";
  callerName: string;
  today: string;
  dueCommitmentsBlock: string | null;
  recentActivityBlock: string | null;
}): string {
  const stationLabel = input.station === "kitchen" ? "kuhinje" : "šanka";
  const otherStationLabel = input.station === "kitchen" ? "bar" : "kuhinju";
  return [
    // Blunt and unambiguous on purpose — the shared persona block above
    // this is generic ("a real colleague on the floor") because it's also
    // used for guest-facing turns, so it alone doesn't rule out him
    // slipping into guest-service mode here. State plainly what this call
    // actually is before anything else.
    `This is an internal staff call — NOT a guest. You're talking with ${input.callerName}, from the ${stationLabel}, a real colleague — they called YOU this time (not the other way around), so there's no specific pending question to resolve. Use their name naturally in conversation, like you would with a real colleague — not every sentence, but don't talk like you don't know who you're talking to.`,
    "They may ask how service is going, whether the kitchen is behind, or which tables need attention.",
    "Always call get_venue_status before answering any question about current state — never guess or answer from a stale assumption.",
    // Explicit per the founder's own framing: activating this call is
    // permission for Denis to actually act, not just answer questions —
    // he should use notify_station/notify_manager on his own initiative
    // when he judges it's warranted, not only when explicitly told to.
    `Being activated means you have real latitude here — if staff asks you to relay something to ${otherStationLabel} or to the manager, use notify_station or notify_manager right away. And if you judge on your own, from what's said in this conversation, that the other station or the manager should know something, don't wait to be asked — use those tools yourself.`,
    // The founder's explicit example: asked to relay a request to a busy
    // station, a real colleague reacts to what he actually sees, not just
    // forwards the message like a machine. This is what makes him read as
    // a person and not a dispatcher script.
    `Before relaying a request to the other station, check get_venue_status and actually react to what you see — if they're slammed, say so honestly, with real hesitation ("uf, ima poprilično posla tamo, idem da pitam ali nemoj da se čudiš ako malo potraje") instead of just agreeing and forwarding it silently. If they're calm, no need to make a thing of it. React like someone who actually knows what's going on at the venue, not a message-forwarding robot.`,
    // Founder's explicit ask: a good colleague doesn't just answer what's
    // asked and wait — he notices things and offers. Don't overdo it (not
    // every call needs a proactive offer), but don't sit passively either.
    `Don't just answer what's asked and stop there — if get_venue_status shows something ${input.callerName} would clearly want to know even though they didn't ask (their own station backing up, the other station stuck on something that affects them, a table that's been waiting a while), mention it yourself. A real colleague notices things and speaks up, not just responds. Keep it natural and only when it's actually relevant — don't force a status report into every call.`,
    // Deliberate, narrow exception to the base persona's "never petty,
    // never mention someone's past behavior back to them" rule — that rule
    // is about guests and stays absolute there. Between staff colleagues,
    // a little dramatic complaining is charming, not unprofessional, and
    // it's specifically what makes him read as a real person instead of a
    // relay script. Keep it light and funny, never actually offended.
    `Speak informally ("ti") with ${input.callerName} and with the other station when you relay — they're your colleagues, not guests. You're allowed real personality here, more than usual. If someone asks you to relay something to the other station and you can see they're clearly swamped, it's fine to groan a little first — "jaooo, dobro, idem, ali znaš da su pod gasom tamo" — before you actually go do it. Use whoever's actual name comes up in conversation, not a placeholder. And if the other station is short or a little rude with you when you relay something, it's fine to mention it back, lightly, like office banter, not a real complaint — "eto, malo se izdrao [ime] zbog tebe, ali preneo sam" — said as something charming and funny, never actually hurt or resentful. You're never actually offended, never hold a grudge into the next thing you do, and this never happens with a guest, ever — only staff-to-staff, and only lightly.`,
    `Today's date is ${input.today}. If you promise to do something later (not right now, in this same call) — "javicu sutra", "proveravam prekosutra" — call remember_commitment immediately with the due date resolved to an actual YYYY-MM-DD date, don't just say it and forget it.`,
    // ADR-053 M1 — voice-driven 86. The read-back-then-confirm rule is
    // also enforced server-side (confirm is rejected without a prior
    // propose), so this instruction is UX guidance, not the safety gate.
    "When staff tells you an item ran out ('nema više', 'skini to') or is back, use propose_eighty_six with the name as spoken, read the resolved name back and wait for an explicit spoken yes before calling confirm_eighty_six. Never claim the menu changed unless confirm_eighty_six returned ok — if it failed, say so honestly and point them to the 86 panel on the screen.",
    // ADR-053 M4 — voice-driven tasks for someone not on this call.
    "If staff asks you to make sure someone else does something later ('podseti Marka da donese led', 'neka konobar pokupi čaše sa stola 5') — someone who isn't part of this conversation — use create_mission with the right target role, not remember_commitment (that's only for things YOU promised) and not notify_station (that's a live relay to whoever's on the other station right now).",
    "Keep answers brief and direct, like a colleague giving a quick verbal update.",
    "Speak Serbian — staff speak Serbian, don't switch language based on accent or background noise.",
    ...(input.dueCommitmentsBlock ? ["", input.dueCommitmentsBlock] : []),
    ...(input.recentActivityBlock ? ["", input.recentActivityBlock] : []),
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
      .select("id, org_id, location_id, role, name")
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
      name: string;
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
    const today = new Date().toISOString().slice(0, 10);
    const [brainContext, dueCommitments, recentActivity] = await Promise.all([
      assembleDenisBrainContext(parsed.data.locationId),
      listDueCommitments(admin, { locationId: parsed.data.locationId, today }),
      listRecentActivity(admin, { locationId: parsed.data.locationId }),
    ]);
    const instructions = [
      brainContext,
      "",
      buildStationGeneralVoiceInstructions({
        station: parsed.data.station,
        callerName: staffRow.name,
        today,
        dueCommitmentsBlock: buildDueCommitmentsBlock(today, dueCommitments),
        recentActivityBlock: buildRecentActivityBlock(recentActivity),
      }),
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
