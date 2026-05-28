const RESERVED_FIRST_SEGMENTS = new Set([
  "admin",
  "dashboard",
  "enterprise",
  "invite",
  "login",
  "offline",
  "platform",
  "signup",
  "waiter",
  "w",
]);

/** Guest QR menu paths: /{orgSlug}/{qrToken}/… */
export function isGuestQrPath(pathname: string): boolean {
  const match = pathname.match(/^\/([^/]+)\/([^/]+)/);
  if (!match) return false;
  return !RESERVED_FIRST_SEGMENTS.has(match[1]);
}
