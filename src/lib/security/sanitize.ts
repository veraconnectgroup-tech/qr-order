import DOMPurify from "isomorphic-dompurify";

export function sanitizeText(input: string, maxLength = 1000): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] })
    .trim()
    .slice(0, maxLength);
}
