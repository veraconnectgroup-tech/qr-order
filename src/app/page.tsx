import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Vera — Enterprise Hospitality Platform",
  description:
    "Bestellung, Küchendisplay, Kartenzahlung und DATEV-Export — ein System für jeden Tisch. KassenSichV-konform. 0 € / Monat.",
  openGraph: {
    title: "Vera — Enterprise Hospitality Platform",
    description:
      "Bestellung, Küchendisplay, Kartenzahlung und DATEV-Export — ein System für jeden Tisch. KassenSichV-konform. 0 € / Monat.",
    locale: "de_DE",
  },
};

export default function HomePage() {
  return <LandingPage />;
}
