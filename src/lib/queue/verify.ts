import { Receiver } from "@upstash/qstash";

export async function verifyQStashSignature(req: Request): Promise<boolean> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (!currentSigningKey) {
    return true;
  }

  const signature = req.headers.get("upstash-signature");
  const body = await req.text();

  const receiver = new Receiver({
    currentSigningKey,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? "",
  });

  try {
    await receiver.verify({
      signature: signature ?? "",
      body,
    });
    return true;
  } catch {
    return false;
  }
}
