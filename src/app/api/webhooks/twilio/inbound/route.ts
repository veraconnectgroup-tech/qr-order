import { apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  isStopKeyword,
  processSmsStopUnsubscribe,
} from "@/lib/notifications/guest-preferences";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/** Twilio inbound webhook — STOP = instant unsubscribe (GDPR). */
export const POST = withErrorHandler("twilio-inbound-post", async (req) => {
  const limited = await withRateLimit(req, "pos-inbound");
  if (limited) return limited;

  const contentType = req.headers.get("content-type") ?? "";
  let bodyText = "";
  let from = "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    bodyText = String(form.get("Body") ?? "");
    from = String(form.get("From") ?? "");
  } else {
    const json = (await req.json().catch(() => ({}))) as {
      Body?: string;
      From?: string;
    };
    bodyText = json.Body ?? "";
    from = json.From ?? "";
  }

  if (!isStopKeyword(bodyText)) {
    return apiSuccess({ handled: false });
  }

  const phone = from.replace(/^whatsapp:/, "").trim();
  if (!phone) {
    return apiSuccess({ handled: false });
  }

  const admin = createAdminClient();
  const count = await processSmsStopUnsubscribe(admin, phone);

  return apiSuccess({ handled: true, unsubscribed: count });
});
