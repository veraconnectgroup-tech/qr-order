"use client";

const faqs = [
  {
    q: "Is Denis KassenSichV compliant?",
    a: "Yes. Every transaction is signed via a certified TSE. DATEV export is included.",
  },
  {
    q: "Do guests need an app?",
    a: "No. Guests scan a QR code and order in the mobile browser.",
  },
  {
    q: "What does Denis cost?",
    a: "€0 per month. We charge a small fee per online card payment only.",
  },
  {
    q: "How fast can I go live?",
    a: "Under 30 minutes. Create an account, upload your menu, print QR codes.",
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="scroll-mt-14 border-t border-[var(--lp-border-subtle)] bg-[var(--lp-bg)]">
      <div className="border-b border-[var(--lp-border-subtle)] px-6 py-3 lg:px-8">
        <h2 className="landing-zone-label">Operator reference</h2>
      </div>

      <dl className="divide-y divide-[var(--lp-border-subtle)]">
        {faqs.map((faq) => (
          <div key={faq.q} className="px-6 py-6 lg:px-8 lg:py-7">
            <dt className="text-[14px] font-medium text-[var(--lp-ink)]">{faq.q}</dt>
            <dd className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--lp-muted)]">
              {faq.a}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
