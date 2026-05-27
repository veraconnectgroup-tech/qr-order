import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Denis — Hospitality operating system · Vera Group",
  description:
    "Guest ordering, kitchen display, staff coordination, and payments — one enterprise platform. Part of Vera Group. KassenSichV compliant. €0 / month.",
  openGraph: {
    title: "Denis — Hospitality operating system",
    description:
      "Run the floor, serve faster, stay compliant. Intelligence embedded — not advertised.",
    locale: "en_US",
  },
};

export default function HomePage() {
  return <LandingPage />;
}
