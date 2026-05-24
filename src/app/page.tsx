import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Vera — Die Hospitality-Plattform",
  description:
    "Bestellung, Küche, Zahlung und Analyse für Gastronomie in Deutschland. KassenSichV-konform. 0 € / Monat.",
  openGraph: {
    title: "Vera — Die Hospitality-Plattform",
    description:
      "Bestellung, Küche, Zahlung und Analyse für Gastronomie in Deutschland. KassenSichV-konform. 0 € / Monat.",
    locale: "de_DE",
  },
};

export default function HomePage() {
  return <LandingPage />;
}
