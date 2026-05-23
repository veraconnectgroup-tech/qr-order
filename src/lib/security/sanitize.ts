const TAG_RE = /<[^>]*>/g;
const SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const ORDER_NOTES_ALLOWED_RE = /[^a-zA-Z0-9\s.,!?'\-"():;/]/g;
const SLUG_INVALID_RE = /[^a-z0-9-]/g;
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

/** Strip script tags and HTML markup (server-safe, no DOM). */
export function sanitizeHtml(input: string): string {
  return input.replace(SCRIPT_RE, "").replace(TAG_RE, "").trim();
}

export function sanitizeText(input: string, maxLength = 1000): string {
  return sanitizeHtml(input).slice(0, maxLength);
}

/** Order notes / special instructions: alphanumeric + basic punctuation, max 500. */
export function sanitizeOrderNotes(input: string): string {
  return sanitizeHtml(input)
    .replace(ORDER_NOTES_ALLOWED_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

/** URL slug: lowercase letters, digits, hyphens only. */
export function sanitizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(SLUG_INVALID_RE, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/** Lowercase, trim, basic RFC-like format check. Returns empty string when invalid. */
export function sanitizeEmail(input: string): string {
  const normalized = input.trim().toLowerCase().slice(0, 254);
  return EMAIL_RE.test(normalized) ? normalized : "";
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
