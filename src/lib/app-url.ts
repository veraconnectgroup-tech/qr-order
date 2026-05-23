function normalizeUrl(url: string) {
  return url.replace(/\/$/, "");
}

function withHttps(hostOrUrl: string) {
  if (hostOrUrl.startsWith("http")) return normalizeUrl(hostOrUrl);
  return `https://${normalizeUrl(hostOrUrl)}`;
}

/** Preview deployments require Vercel login — never encode them in guest QR codes. */
export function isPreviewDeploymentHost(host: string) {
  const lower = host.toLowerCase();
  if (lower.includes("-git-")) return true;
  if (lower.includes("---")) return true;
  return false;
}

export function isUnsafeGuestBaseUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    return isPreviewDeploymentHost(hostname);
  } catch {
    return true;
  }
}

function configuredAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured || configured.includes("localhost")) return null;
  return withHttps(configured);
}

function vercelProductionUrl() {
  const host =
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim() ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!host) return null;
  return withHttps(host);
}

/**
 * Base URL for guest links (QR codes, menu URLs).
 * Always prefers the public production domain so guests never hit preview auth.
 */
export function getGuestAppBaseUrl(clientOrigin?: string | null): string {
  const configured = configuredAppUrl();
  if (configured) return configured;

  const production = vercelProductionUrl();
  if (production) return production;

  const origin = clientOrigin?.trim();
  if (origin?.startsWith("http")) {
    try {
      const { hostname } = new URL(origin);
      if (!isPreviewDeploymentHost(hostname) && hostname !== "localhost") {
        return normalizeUrl(origin);
      }
    } catch {
      // fall through
    }
  }

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) {
    return vercel.startsWith("http") ? normalizeUrl(vercel) : `https://${vercel}`;
  }

  const local = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (local) return local;

  return "http://localhost:3000";
}

/** General app URL (emails, redirects). Falls back to current origin when safe. */
export function getAppBaseUrl(clientOrigin?: string | null): string {
  return getGuestAppBaseUrl(clientOrigin);
}

/** Server-side app URL for Stripe redirects, emails, webhooks. */
export function getServerAppUrl(): string {
  return getGuestAppBaseUrl(null);
}

function joinGuestPath(base: string, ...segments: string[]) {
  const cleanBase = normalizeUrl(base);
  const path = segments
    .map((segment) => segment.trim().replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return path ? `${cleanBase}/${path}` : cleanBase;
}

export function guestTableUrl(
  orgSlug: string,
  qrToken: string,
  clientOrigin?: string | null
) {
  return joinGuestPath(getGuestAppBaseUrl(clientOrigin), orgSlug, qrToken);
}
