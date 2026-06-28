import { logger } from "@/lib/logger";

export type SendSmsInput = {
  to: string;
  body: string;
  templateId?: string;
};

export type SendSmsResult =
  | { ok: true; provider: "twilio" | "messagebird"; messageId?: string }
  | { skipped: true; reason: string }
  | { error: string };

function normalizeE164(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed;
  return `+${trimmed.replace(/\D/g, "")}`;
}

async function sendViaTwilio(input: SendSmsInput): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;

  if (!accountSid || !authToken || !from) {
    return { skipped: true, reason: "twilio_not_configured" };
  }

  const body = new URLSearchParams({
    To: normalizeE164(input.to),
    From: from,
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
    logger.error("Twilio SMS failed", {
      status: res.status,
      templateId: input.templateId,
      body: text.slice(0, 200),
    });
    return { error: `Twilio SMS failed (${res.status})` };
  }

  const json = (await res.json()) as { sid?: string };
  return { ok: true, provider: "twilio", messageId: json.sid };
}

async function sendViaMessageBird(input: SendSmsInput): Promise<SendSmsResult> {
  const apiKey = process.env.MESSAGEBIRD_API_KEY;
  const originator = process.env.MESSAGEBIRD_ORIGINATOR;

  if (!apiKey || !originator) {
    return { skipped: true, reason: "messagebird_not_configured" };
  }

  const res = await fetch("https://rest.messagebird.com/messages", {
    method: "POST",
    headers: {
      Authorization: `AccessKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      originator,
      recipients: [normalizeE164(input.to)],
      body: input.body,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error("MessageBird SMS failed", {
      status: res.status,
      templateId: input.templateId,
      body: text.slice(0, 200),
    });
    return { error: `MessageBird SMS failed (${res.status})` };
  }

  const json = (await res.json()) as { id?: string };
  return { ok: true, provider: "messagebird", messageId: json.id };
}

/** Send SMS via Twilio, falling back to MessageBird when Twilio is not configured. */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  if (!input.to.trim() || !input.body.trim()) {
    return { skipped: true, reason: "missing_to_or_body" };
  }

  const twilio = await sendViaTwilio(input);
  if ("ok" in twilio && twilio.ok) return twilio;
  if ("error" in twilio) return twilio;

  return sendViaMessageBird(input);
}

export function isSmsConfigured(): boolean {
  const twilio =
    Boolean(process.env.TWILIO_ACCOUNT_SID) &&
    Boolean(process.env.TWILIO_AUTH_TOKEN) &&
    Boolean(process.env.TWILIO_SMS_FROM);
  const messagebird =
    Boolean(process.env.MESSAGEBIRD_API_KEY) &&
    Boolean(process.env.MESSAGEBIRD_ORIGINATOR);
  return twilio || messagebird;
}
