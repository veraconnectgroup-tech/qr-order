const TAG_RE = /<[^>]*>/g;

export function sanitizeText(input: string, maxLength = 1000): string {
  return input.replace(TAG_RE, "").trim().slice(0, maxLength);
}
