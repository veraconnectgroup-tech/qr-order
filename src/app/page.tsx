import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Denis — Hospitality operating system · Vera Group",
  description:
    "Mission control for hospitality operations — orders, floor routing, prep display, and Denis intelligence. Part of Vera Group.",
  openGraph: {
    title: "Denis — Hospitality operating system",
    description:
      "Open Denis. Coordinate the floor, kitchen, and guest channel from one operational environment.",
    locale: "en_US",
  },
};

export default function HomePage() {
  return <LandingPage />;
}
