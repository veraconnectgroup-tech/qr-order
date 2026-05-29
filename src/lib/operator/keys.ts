import { createHash, randomBytes } from "crypto";

export const OPERATOR_KEY_PREFIX = "dns_op_live_";

export function hashOperatorApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateOperatorApiKey(): {
  rawKey: string;
  prefix: string;
  hash: string;
} {
  const token = randomBytes(24).toString("base64url");
  const rawKey = `${OPERATOR_KEY_PREFIX}${token}`;
  const prefix = rawKey.slice(0, 16);
  return { rawKey, prefix, hash: hashOperatorApiKey(rawKey) };
}

export function isOperatorApiKeyFormat(rawKey: string): boolean {
  return rawKey.startsWith(OPERATOR_KEY_PREFIX) && rawKey.length > OPERATOR_KEY_PREFIX.length + 8;
}
