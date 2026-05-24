import { createHmac, timingSafeEqual } from "crypto";

function extractSignatureHeader(headers: Headers): string | null {
  return (
    headers.get("x-vera-signature") ??
    headers.get("x-webhook-signature") ??
    headers.get("x-deliverect-signature") ??
    headers.get("x-deliverect-hmac-sha256")
  );
}

function normalizeSignature(raw: string): string {
  return raw.startsWith("sha256=") ? raw.slice(7) : raw;
}

export function verifyPosWebhookSignature(
  rawBody: string,
  headers: Headers,
  secret: string
): boolean {
  const header = extractSignatureHeader(headers);
  if (!header || !secret) return false;

  const hmac = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = normalizeSignature(header.trim());

  try {
    const expected = Buffer.from(hmac, "utf8");
    const got = Buffer.from(received, "utf8");
    if (expected.length !== got.length) return false;
    return timingSafeEqual(expected, got);
  } catch {
    return hmac === received;
  }
}

export function webhookSecretFromConfig(
  config: Record<string, unknown>
): string | null {
  const secret =
    typeof config.webhook_secret === "string"
      ? config.webhook_secret.trim()
      : "";
  return secret || null;
}
