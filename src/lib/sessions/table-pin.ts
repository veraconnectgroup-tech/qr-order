import { randomInt, scryptSync, timingSafeEqual } from "crypto";

const PIN_SCRYPT_KEYLEN = 32;
const PIN_SCRYPT_SALT_BYTES = 16;

/** Cryptographically random 4-digit PIN (1000–9999). */
export function generateTablePin(): string {
  return String(randomInt(1000, 10000));
}

export function hashTablePin(pin: string): string {
  const salt = Buffer.alloc(PIN_SCRYPT_SALT_BYTES, pin.slice(0, 2));
  const hash = scryptSync(pin, salt, PIN_SCRYPT_KEYLEN);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyTablePin(pin: string, stored: string): boolean {
  if (!/^\d{4}$/.test(pin)) return false;
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const actual = scryptSync(pin, salt, PIN_SCRYPT_KEYLEN);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
