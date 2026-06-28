import { logger } from "@/lib/logger";

export type SendWhatsAppInput = {
  to: string;
  body: string;
  templateId?: string;
};

export type SendWhatsAppResult =
  | { ok: true; messageId?: string }
  | { skipped: true; reason: string }
  | { error: string };

function normalizeWhatsAppTo(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("whatsapp:")) return trimmed;
  const e164 = trimmed.startsWith("+")
    ? trimmed
    : `+${trimmed.replace(/\D/g, "")}`;
  return `whatsapp:${e164}`;
}

/** Send WhatsApp message via Twilio WhatsApp API. */
export async function sendWhatsApp(
  input: SendWhatsAppInput
): Promise<SendWhatsAppResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    return { skipped: true, reason: "twilio_whatsapp_not_configured" };
  }

  if (!input.to.trim() || !input.body.trim()) {
    return { skipped: true, reason: "missing_to_or_body" };
  }

  const body = new URLSearchParams({
    To: normalizeWhatsAppTo(input.to),
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    Body: input.body,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    logger.error("Twilio WhatsApp failed", {
      status: res.status,
      templateId: input.templateId,
      body: text.slice(0, 200),
    });
    return { error: `Twilio WhatsApp failed (${res.status})` };
  }

  const json = (await res.json()) as { sid?: string };
  return { ok: true, messageId: json.sid };
}

export function isWhatsAppConfigured(): boolean {
  return (
    Boolean(process.env.TWILIO_ACCOUNT_SID) &&
    Boolean(process.env.TWILIO_AUTH_TOKEN) &&
    Boolean(process.env.TWILIO_WHATSAPP_FROM)
  );
}
