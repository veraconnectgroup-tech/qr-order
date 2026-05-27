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
    <section id="faq" className="scroll-mt-14 border-t border-zinc-800/80 bg-[#08080c] text-white">
      <div className="flex items-baseline gap-3 border-b border-zinc-800/60 px-6 py-3 lg:px-8">
        <span className="font-mono text-[11px] tabular-nums text-zinc-600">06</span>
        <h2 className="text-[13px] font-medium tracking-tight text-zinc-300">
          Operator reference
        </h2>
      </div>

      <dl className="divide-y divide-zinc-800/60">
        {faqs.map((faq) => (
          <div key={faq.q} className="px-6 py-5 lg:px-8 lg:py-6">
            <dt className="text-[14px] font-medium text-zinc-300">{faq.q}</dt>
            <dd className="mt-2 max-w-2xl text-[14px] leading-relaxed text-zinc-500">
              {faq.a}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
