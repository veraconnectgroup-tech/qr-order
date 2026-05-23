import type { Metadata } from "next";

const APP_NAME = "QR Order";

export function guestPageMetadata({
  orgName,
  slug,
  pageTitle,
  description,
  logoUrl,
  noIndex = false,
}: {
  orgName: string;
  slug: string;
  pageTitle?: string;
  description?: string;
  logoUrl?: string | null;
  noIndex?: boolean;
}): Metadata {
  const title = pageTitle ? `${pageTitle} — ${orgName}` : `${orgName} — Menu`;
  const desc =
    description ??
    `Browse the menu, order, and pay at ${orgName}. Scan the QR code at your table — no app required.`;

  return {
    title,
    description: desc,
    manifest: `/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
    icons: logoUrl
      ? { apple: [{ url: logoUrl }] }
      : { apple: [{ url: "/icon-192.png" }] },
    openGraph: {
      title,
      description: desc,
      siteName: APP_NAME,
      type: "website",
      locale: "en_US",
      images: [
        {
          url: `/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${orgName} — Menu`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [`/${slug}/opengraph-image`],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}
