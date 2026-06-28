import type { Metadata } from "next";
import Script from "next/script";
import { LandingPage } from "@/components/landing/landing-page";
import { landingAlternates, landingJsonLd } from "@/lib/landing/landing-seo";
import { landingCopy } from "@/lib/landing/landing-copy";

const defaultCopy = landingCopy("en");

export const metadata: Metadata = {
  title: defaultCopy.meta.title,
  description: defaultCopy.meta.description,
  alternates: landingAlternates(),
  openGraph: {
    title: defaultCopy.meta.title,
    description: defaultCopy.meta.description,
    locale: "en_US",
    alternateLocale: ["de_DE", "sr_RS"],
    type: "website",
    siteName: "Denis · Vera Group",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultCopy.meta.title,
    description: defaultCopy.meta.description,
    images: ["/opengraph-image"],
  },
  keywords: [
    "Denis",
    "AI waiter",
    "QR ordering",
    "restaurant POS",
    "KassenSichV",
    "kitchen display",
    "hospitality software",
  ],
};

export default function HomePage() {
  const jsonLd = landingJsonLd("en");

  return (
    <>
      <Script
        id="landing-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
