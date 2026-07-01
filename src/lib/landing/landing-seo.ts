import type { LandingLocale } from "@/lib/landing/landing-copy";

export function landingJsonLd(locale: LandingLocale) {
  const descriptions: Record<LandingLocale, string> = {
    de: "KI-Kellner und Hospitality-Betriebssystem für QR-Bestellung, Küche und Zahlung.",
    en: "AI waiter and hospitality operating system for QR ordering, kitchen, and payments.",
    sr: "AI konobar i hospitality OS za QR narudžbinu, kuhinju i plaćanje.",
  };

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Denis",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
    description: descriptions[locale],
    publisher: {
      "@type": "Organization",
      name: "Vera Group",
    },
  };
}

export function landingAlternates() {
  return {
    canonical: "/",
    languages: {
      de: "/?lang=de",
      en: "/?lang=en",
      sr: "/?lang=sr",
    },
  };
}
