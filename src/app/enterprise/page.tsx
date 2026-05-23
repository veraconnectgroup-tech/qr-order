import type { Metadata } from "next";
import { LandingEnterprise } from "@/components/landing/landing-enterprise";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";

export const metadata: Metadata = {
  title: "Enterprise — Multi-location hospitality ordering",
  description:
    "QR Order for hotel F&B, bar groups, and multi-location operators. Structured rollout, Stripe Connect at scale, and live operations across every venue.",
};

export default function EnterprisePage() {
  return (
    <div className="landing-page min-h-screen overflow-x-hidden antialiased">
      <LandingNav />
      <main>
        <LandingEnterprise fullPage />
      </main>
      <LandingFooter />
    </div>
  );
}
