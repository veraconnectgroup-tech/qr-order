import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Denis — Hospitality AI · Vera Group",
  description:
    "Der Concierge für Ihren Gastraum. Bestellung, Küche, Zahlung und Analyse — Part of Vera Group. KassenSichV-konform. 0 € / Monat.",
  openGraph: {
    title: "Denis — Hospitality AI · Vera Group",
    description:
      "Der Concierge für Ihren Gastraum. Bestellung, Küche, Zahlung und Analyse — Part of Vera Group.",
    locale: "de_DE",
  },
};

export default function HomePage() {
  return <LandingPage />;
}
