import { Receiver } from "@upstash/qstash";
import { logger } from "@/lib/logger";

export async function verifyQStashSignature(req: Request): Promise<boolean> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const signature = req.headers.get("upstash-signature");

  if (!currentSigningKey) {
    if (process.env.NODE_ENV === "development") {
      logger.warn("QStash signature verification skipped — no signing key");
      return true;
    }
    logger.error("QStash webhook rejected — signing key not configured");
    return false;
  }

  if (!signature) {
    logger.warn("QStash webhook rejected — missing upstash-signature header");
    return false;
  }

  const body = await req.text();

  const receiver = new Receiver({
    currentSigningKey,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? "",
  });

  try {
    await receiver.verify({
      signature,
      body,
    });
    return true;
  } catch (error) {
    logger.warn("QStash webhook signature verification failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
