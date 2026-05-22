/**
 * Public base URL for guest links (QR codes, menu URLs, emails).
 * Client: uses current origin so QR codes match the deployed site.
 * Server: NEXT_PUBLIC_APP_URL → VERCEL_URL → localhost.
 */
export function getAppBaseUrl(clientOrigin?: string | null): string {
  if (clientOrigin?.startsWith("http")) {
    return clientOrigin.replace(/\/$/, "");
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured && !configured.includes("localhost")) {
    return configured;
  }

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) {
    return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  }

  if (configured) return configured;

  return "http://localhost:3000";
}

export function guestTableUrl(
  orgSlug: string,
  qrToken: string,
  clientOrigin?: string | null
) {
  return `${getAppBaseUrl(clientOrigin)}/${orgSlug}/${qrToken}`;
}
