import { z } from "zod";
import {
  sanitizeEmail,
  sanitizeOrderNotes,
  sanitizeText,
} from "@/lib/security/sanitize";

export const zUuid = () => z.string().trim().uuid();

export const zToken = () => z.string().trim().min(1).max(128);

export const zSessionToken = zToken;
export const zTableToken = zToken;

export function zSanitizedText(maxLength = 1000) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => sanitizeText(value, maxLength));
}

export function zOptionalSanitizedText(maxLength = 1000) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) =>
      value ? sanitizeText(value, maxLength) : undefined
    );
}

export function zOrderNotesOptional(maxLength = 500) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => (value ? sanitizeOrderNotes(value) : undefined));
}

export function zOrderNotesNullish(maxLength = 500) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .nullish()
    .transform((value) => (value ? sanitizeOrderNotes(value) : (value ?? "")));
}

export function zEmailNormalized() {
  return z
    .string()
    .trim()
    .max(254)
    .transform((value) => sanitizeEmail(value))
    .pipe(z.string().email());
}

export function zOptionalEmailNormalized() {
  return z
    .string()
    .trim()
    .max(254)
    .optional()
    .transform((value) => {
      if (!value) return "";
      return sanitizeEmail(value);
    })
    .pipe(z.union([z.literal(""), z.string().email()]));
}

export const zInviteToken = () => z.string().trim().min(1).max(128);
