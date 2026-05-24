import type { Metadata } from "next";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";

export const metadata: Metadata = {
  title: "FAQ — Vera",
  description: "Häufige Fragen zu Vera — QR-Bestellung, KassenSichV, Preise und POS-Integration.",
};

export default function FaqPage() {
  return (
    <div className="landing-page landing-raycast relative min-h-screen overflow-x-hidden antialiased">
      <LandingNav />
      <main className="relative z-[2] pt-16">
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  );
}
