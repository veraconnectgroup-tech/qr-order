export type LandingLocale = "de" | "en" | "sr";

export const LANDING_LOCALES: LandingLocale[] = ["de", "en", "sr"];

export type LandingCopy = {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    platform: string;
    enterprise: string;
    pricing: string;
    faq: string;
    signIn: string;
    cta: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    lead: string;
    cta: string;
    ctaSecondary: string;
    meta: string;
    demoLabel: string;
  };
  trust: string;
  features: Array<{
    id: string;
    eyebrow: string;
    title: string;
    lead: string;
    bullets: string[];
    reverse?: boolean;
  }>;
  social: {
    eyebrow: string;
    title: string;
    lead: string;
    stats: Array<{
      value: number;
      suffix: string;
      prefix?: string;
      decimals?: number;
      label: string;
    }>;
    testimonials: Array<{ quote: string; name: string; role: string }>;
  };
  pricing: {
    eyebrow: string;
    title: string;
    lead: string;
    popular: string;
    roiTitle: string;
    roiLead: string;
    roiCovers: string;
    roiTicket: string;
    roiUplift: string;
    roiResult: string;
    compareTitle: string;
    plans: Array<{
      name: string;
      price: string;
      period: string;
      fee: string;
      description: string;
      features: string[];
      cta: string;
      href: string;
      primary: boolean;
      complianceNote?: string;
    }>;
    featureMatrix: {
      headers: string[];
      rows: Array<{ label: string; values: boolean[] }>;
    };
  };
  enterprise: {
    eyebrow: string;
    title: string;
    lead: string;
    pillars: Array<{ title: string; description: string }>;
    caseStudies: Array<{ venue: string; result: string; quote: string }>;
    cta: string;
    ctaSecondary: string;
  };
  faq: {
    title: string;
    lead: string;
    items: Array<{ q: string; a: string }>;
  };
  ctaBanner: {
    title: string;
    lead: string;
    primary: string;
    secondary: string;
    footnote: string;
  };
  footer: {
    tagline: string;
    copyright: string;
  };
};

const copyDe: LandingCopy = {
  meta: {
    title: "Denis — KI-Kellner, der nie schläft · Vera Group",
    description:
      "Gäste bestellen per QR, Küche und Service bleiben synchron — Denis assistiert am Tisch. KassenSichV-konform. 0 € / Monat.",
  },
  nav: {
    platform: "Plattform",
    enterprise: "Enterprise",
    pricing: "Preise",
    faq: "FAQ",
    signIn: "Anmelden",
    cta: "Kostenlos starten",
  },
  hero: {
    eyebrow: "Denis · Part of Vera Group",
    title: "Denis — KI-Kellner,",
    titleAccent: " der nie schläft.",
    lead:
      "Gäste scannen, bestellen und zahlen am Tisch. Denis kennt Menü, Allergene und den Servicefluss — ohne App-Download.",
    cta: "Kostenlos testen",
    ctaSecondary: "Live-Demo",
    meta: "0 € / Monat · KassenSichV · Live in unter 30 Minuten",
    demoLabel: "Live — Denis am Tisch",
  },
  trust: "Vertraut in Gastronomie · Integrationen & Compliance",
  features: [
    {
      id: "features-guest",
      eyebrow: "Gast-Bestellung",
      title: "Scannen, bestellen, zahlen — ohne App",
      lead: "Gäste bestellen in Sekunden vom Handy. Kartenzahlung, Split Bill und Tischkontext inklusive.",
      bullets: [
        "QR-Menü mit Live-Verfügbarkeit und Modifikatoren",
        "Stripe Connect Checkout am Tisch",
        "Split Bill und Order-Tracking in einem Flow",
      ],
    },
    {
      id: "features-kitchen",
      eyebrow: "Küche & Bar",
      title: "Jede Bestellung trifft sofort die richtige Station",
      lead: "Küchendisplay, Bar-Routing und Live-Boards bleiben synchron — ohne Papier, ohne verpasste Fires.",
      bullets: [
        "Prep-Display mit kontrastreichen Tickets",
        "Live Order Board für Floor und Bar",
        "Status fließt automatisch zurück zu Gästen",
      ],
      reverse: true,
    },
    {
      id: "features-staff",
      eyebrow: "Service-Koordination",
      title: "Den Floor aus einem Cockpit steuern",
      lead: "Tische, Kellnerrufe, Umsatz und Quick Actions — für Servicegeschwindigkeit, nicht Dashboard-Clutter.",
      bullets: [
        "Zonen-Tischboard mit Live-Session-Summen",
        "Kellnerrufe und Order-Historie in einer Shell",
        "Umsatz- und Floor-Snapshot above the fold",
      ],
    },
    {
      id: "features-denis",
      eyebrow: "Intelligence & Compliance",
      title: "Eingebettete Intelligenz — kein Chatbot-Gimmick",
      lead: "Denis assistiert Gästen und Team leise — Empfehlungen, Bestellung und deutsche Fiscal-Compliance in einem System.",
      bullets: [
        "Strukturiertes Concierge-Panel — keine iMessage-Blasen",
        "Pay-as-you-go AI Credits — 1 Credit pro assistierter Nachricht",
        "KassenSichV, TSE, DATEV-Export inklusive",
        "Allergenbewusste Empfehlungen am Tisch",
      ],
      reverse: true,
    },
  ],
  social: {
    eyebrow: "Social proof",
    title: "Operatoren, die Denis einsetzen",
    lead: "Messbare Wirkung auf Umsatz, Servicegeschwindigkeit und Compliance.",
    stats: [
      { value: 1000, suffix: "+", label: "Bestellungen verarbeitet" },
      { value: 30, suffix: "s", prefix: "<", label: "Gast-Bestellzeit" },
      { value: 99.9, suffix: "%", decimals: 1, label: "Uptime-Ziel" },
      { value: 24, suffix: "/7", label: "Gast-Bestellung" },
    ],
    testimonials: [
      {
        quote:
          "Denis fühlt sich wie Operations-Software an — nicht wie ein Menü-PDF mit Zahlung.",
        name: "Leiter Operations",
        role: "Multi-Concept-Gruppe · 6 Standorte",
      },
      {
        quote:
          "Upsell über Denis ist spürbar, ohne dass Gäste einen Chatbot spüren.",
        name: "Restaurantleitung",
        role: "Fine Dining · Hamburg",
      },
    ],
  },
  pricing: {
    eyebrow: "Preise",
    title: "Transparente Preise",
    lead: "Keine Plattformgebühr im Standard. Klare Kartengebühr über Stripe.",
    popular: "Beliebteste Wahl",
    roiTitle: "ROI berechnen",
    roiLead: "Schätzen Sie Denis-Uplift für Ihren Betrieb.",
    roiCovers: "Covers pro Tag",
    roiTicket: "Ø Bon (€)",
    roiUplift: "Upsell-Uplift (%)",
    roiResult: "Geschätzter Monats-Uplift",
    compareTitle: "Plan-Vergleich",
    plans: [
      {
        name: "Standard",
        price: "€0",
        period: "/ Monat",
        fee: "Kleine Gebühr pro Kartenzahlung",
        description: "Volle Plattform. Zahlen nur bei Kartencheckout.",
        features: [
          "QR-Menü & Live-Bestellung",
          "Küchendisplay & Kellnerruf",
          "Stripe Connect",
          "Analytics & CSV-Export",
          "Denis AI optional (Pay-as-you-go)",
        ],
        cta: "Kostenlos starten",
        href: "/signup",
        primary: true,
        complianceNote: "KassenSichV · DSGVO · DATEV · TSE",
      },
      {
        name: "Growth",
        price: "€49",
        period: "/ Monat",
        fee: "Inkl. 2.000 Denis-Credits / Monat",
        description: "Für volle Service-Tage mit aktivem Denis-Concierge.",
        features: [
          "Alles aus Standard",
          "Denis-Credits inklusive",
          "Proactive Nudges & Pairings",
          "Priority E-Mail-Support",
          "Multi-Zone Floor Board",
        ],
        cta: "Growth wählen",
        href: "/signup?plan=growth",
        primary: false,
      },
      {
        name: "Enterprise",
        price: "Individuell",
        period: "",
        fee: "Volume-Preise & Onboarding",
        description: "Ketten, Hotel F&B und High-Volume.",
        features: [
          "Alles aus Growth",
          "Multi-Location Rollout",
          "API & White-Label",
          "SLA & Account Manager",
          "Custom Integrationen",
        ],
        cta: "Sales kontaktieren",
        href: "/enterprise",
        primary: false,
        complianceNote: "KassenSichV · DATEV · TSE",
      },
    ],
    featureMatrix: {
      headers: ["Standard", "Growth", "Enterprise"],
      rows: [
        { label: "QR-Bestellung & KDS", values: [true, true, true] },
        { label: "Denis AI Concierge", values: [true, true, true] },
        { label: "Inkl. Denis-Credits", values: [false, true, true] },
        { label: "Multi-Location", values: [false, false, true] },
        { label: "API / White-Label", values: [false, false, true] },
      ],
    },
  },
  enterprise: {
    eyebrow: "Enterprise",
    title: "Infrastruktur für Gastronomie-Gruppen",
    lead: "Multi-Standort, API, White-Label und dediziertes Onboarding.",
    pillars: [
      {
        title: "Multi-Location Governance",
        description: "Organisationen, Venues, Zonen — eine Hierarchie, rollenbasierter Zugriff.",
      },
      {
        title: "API & Integrationen",
        description: "Deliverect, POS-Bridges und Webhooks für Ihre IT-Landschaft.",
      },
      {
        title: "White-Label",
        description: "Eigenes Branding für Gäste- und Staff-Oberflächen auf Anfrage.",
      },
    ],
    caseStudies: [
      {
        venue: "Skyline Lounge · 120 Plätze",
        result: "+18% Ø Bon nach 6 Wochen Denis",
        quote: "Floor-Team sieht Korbe früher — Gäste bestellen ohne zu warten.",
      },
      {
        venue: "Hotel F&B · 4 Outlets",
        result: "Ein Dashboard für alle Locations",
        quote: "Rollout in drei Wochen statt drei Monaten.",
      },
    ],
    cta: "Enterprise anfragen",
    ctaSecondary: "Mit Standard starten",
  },
  faq: {
    title: "FAQ",
    lead: "Häufige Fragen von Betreibern in DACH.",
    items: [
      {
        q: "Ist Denis KassenSichV-konform?",
        a: "Ja. Jede Transaktion wird über eine zertifizierte TSE signiert. DATEV-Export ist enthalten.",
      },
      {
        q: "Brauchen Gäste eine App?",
        a: "Nein. QR scannen, im Browser bestellen — kein Download.",
      },
      {
        q: "Wie funktioniert Split Bill?",
        a: "Gäste teilen nach Posten oder gleichmäßig — jeder zahlt separat.",
      },
      {
        q: "Was kostet Denis?",
        a: "0 € Plattform im Standard. Kartenzahlung über Stripe. Denis AI optional per Credits.",
      },
      {
        q: "Wie schnell bin ich live?",
        a: "Unter 30 Minuten: Account, Menü, QR-Codes drucken.",
      },
      {
        q: "POS-Anbindung?",
        a: "Deliverect, Orderbird, Lightspeed u.a. — kontaktieren Sie uns für Ihr Setup.",
      },
    ],
  },
  ctaBanner: {
    title: "Ihre Gäste sind bereit. Sind Sie es auch?",
    lead: "Pilot starten — keine Kreditkarte. Live in unter 30 Minuten.",
    primary: "Kostenlos starten",
    secondary: "Live-Demo",
    footnote: "Entwickelt in Hamburg",
  },
  footer: {
    tagline:
      "Denis — Hospitality-Betriebssystem für Bestellung, Küche, Zahlung und Compliance.",
    copyright: "© 2026 Vera Group · Hamburg, Deutschland",
  },
};

const copyEn: LandingCopy = {
  ...copyDe,
  meta: {
    title: "Denis — AI waiter that never sleeps · Vera Group",
    description:
      "Guests order by QR; kitchen and floor stay in sync — Denis assists at the table. KassenSichV ready. €0 / month.",
  },
  nav: {
    platform: "Platform",
    enterprise: "Enterprise",
    pricing: "Pricing",
    faq: "FAQ",
    signIn: "Sign in",
    cta: "Try for free",
  },
  hero: {
    eyebrow: "Denis · Part of Vera Group",
    title: "Denis — AI waiter",
    titleAccent: " that never sleeps.",
    lead:
      "Guests scan, order, and pay at the table. Denis knows your menu, allergens, and service flow — no app download.",
    cta: "Try for free",
    ctaSecondary: "Live demo",
    meta: "€0 / month · KassenSichV · Live in under 30 minutes",
    demoLabel: "Live — Denis at the table",
  },
  trust: "Trusted in hospitality · Integrations & compliance",
  features: [
    {
      id: "features-guest",
      eyebrow: "Guest ordering",
      title: "Scan, browse, pay — no app download",
      lead: "Guests order from their phone in seconds. Card payments, split bills, and table context built in.",
      bullets: [
        "QR menu with live availability and modifiers",
        "Stripe Connect checkout at the table",
        "Split bill and order tracking in one flow",
      ],
    },
    {
      id: "features-kitchen",
      eyebrow: "Kitchen & bar sync",
      title: "Every order hits the right station instantly",
      lead: "Kitchen display, bar routing, and live order boards stay in sync — no paper tickets, no missed fires.",
      bullets: [
        "Prep display with high-contrast ticket cards",
        "Live order board for floor and bar staff",
        "Status updates flow back to guests automatically",
      ],
      reverse: true,
    },
    {
      id: "features-staff",
      eyebrow: "Staff coordination",
      title: "Run the floor from one operational cockpit",
      lead: "Tables, waiter calls, revenue, and quick actions — designed for service speed, not dashboard clutter.",
      bullets: [
        "Zone-based table board with live session totals",
        "Waiter calls and order history in one shell",
        "Revenue and floor snapshot above the fold",
      ],
    },
    {
      id: "features-denis",
      eyebrow: "Intelligence & compliance",
      title: "Embedded intelligence, not a chatbot gimmick",
      lead: "Denis assists guests and staff quietly — recommendations, ordering, and German fiscal compliance in one system.",
      bullets: [
        "Structured concierge panel — not iMessage bubbles",
        "Pay-as-you-go AI credits — 1 credit per assisted message",
        "KassenSichV, TSE, DATEV export included",
        "Allergen-aware recommendations at the table",
      ],
      reverse: true,
    },
  ],
  social: {
    eyebrow: "Social proof",
    title: "Operators running Denis",
    lead: "Measurable impact on revenue, speed, and compliance.",
    stats: [
      { value: 1000, suffix: "+", label: "Orders processed" },
      { value: 30, suffix: "s", prefix: "<", label: "Guest order time" },
      { value: 99.9, suffix: "%", label: "Uptime target" },
      { value: 24, suffix: "/7", label: "Guest ordering" },
    ],
    testimonials: copyDe.social.testimonials.map((t) => ({
      ...t,
      quote:
        t === copyDe.social.testimonials[0]
          ? "Denis feels like operational software — not a menu PDF with payments bolted on."
          : "Upsell through Denis is tangible without guests feeling a chatbot.",
      role:
        t === copyDe.social.testimonials[0]
          ? "Multi-concept group · 6 locations"
          : "Fine dining · Hamburg",
    })),
  },
  pricing: {
    ...copyDe.pricing,
    eyebrow: "Pricing",
    title: "Transparent pricing",
    lead: "No platform fee on Standard. Clear card fee via Stripe.",
    popular: "Most popular",
    roiTitle: "Calculate ROI",
    roiLead: "Estimate Denis uplift for your venue.",
    roiCovers: "Covers per day",
    roiTicket: "Avg ticket (€)",
    roiUplift: "Upsell uplift (%)",
    roiResult: "Estimated monthly uplift",
    compareTitle: "Plan comparison",
    plans: copyDe.pricing.plans.map((p, i) =>
      i === 0
        ? { ...p, name: "Standard", cta: "Start free", fee: "Small fee per card payment" }
        : i === 1
          ? { ...p, name: "Growth", cta: "Choose Growth", fee: "Includes 2,000 Denis credits / month" }
          : { ...p, name: "Enterprise", cta: "Contact sales", fee: "Volume pricing & onboarding" }
    ),
    featureMatrix: {
      headers: ["Standard", "Growth", "Enterprise"],
      rows: [
        { label: "QR ordering & KDS", values: [true, true, true] },
        { label: "Denis AI concierge", values: [true, true, true] },
        { label: "Included Denis credits", values: [false, true, true] },
        { label: "Multi-location", values: [false, false, true] },
        { label: "API / white-label", values: [false, false, true] },
      ],
    },
  },
  enterprise: {
    eyebrow: "Enterprise",
    title: "Infrastructure for hospitality groups",
    lead: "Multi-location, API, white-label, and dedicated onboarding.",
    pillars: [
      {
        title: "Multi-location governance",
        description: "Organizations, venues, zones — one hierarchy, role-based access.",
      },
      {
        title: "API & integrations",
        description: "Deliverect, POS bridges, and webhooks for your stack.",
      },
      {
        title: "White-label",
        description: "Your branding on guest and staff surfaces on request.",
      },
    ],
    caseStudies: [
      {
        venue: "Skyline Lounge · 120 seats",
        result: "+18% avg check after 6 weeks with Denis",
        quote: "The floor sees carts earlier — guests order without waiting.",
      },
      {
        venue: "Hotel F&B · 4 outlets",
        result: "One dashboard for every location",
        quote: "Rollout in three weeks instead of three months.",
      },
    ],
    cta: "Talk to enterprise sales",
    ctaSecondary: "Start with Standard",
  },
  faq: {
    title: "FAQ",
    lead: "Common questions from operators.",
    items: copyDe.faq.items.map((item, i) => ({
      q: [
        "Is Denis KassenSichV compliant?",
        "Do guests need an app?",
        "How does split bill work?",
        "What does Denis cost?",
        "How fast can I go live?",
        "POS integration?",
      ][i]!,
      a: [
        "Yes. Every transaction is TSE-signed. DATEV export included.",
        "No. Scan QR and order in the browser.",
        "Split by items or evenly — each guest pays separately.",
        "€0 platform on Standard. Card payments via Stripe. Denis AI optional credits.",
        "Under 30 minutes: account, menu, print QR codes.",
        "Deliverect, Orderbird, Lightspeed — contact us for your setup.",
      ][i]!,
    })),
  },
  ctaBanner: {
    title: "Your guests are ready. Are you?",
    lead: "Start the pilot — no credit card. Live in under 30 minutes.",
    primary: "Try for free",
    secondary: "Live demo",
    footnote: "Built in Hamburg",
  },
  footer: {
    tagline:
      "Denis — hospitality operating system for ordering, kitchen, payments, and compliance.",
    copyright: "© 2026 Vera Group · Hamburg, Germany",
  },
};

const copySr: LandingCopy = {
  ...copyEn,
  meta: {
    title: "Denis — AI konobar koji nikad ne spava · Vera Group",
    description:
      "Gosti naručuju preko QR-a; kuhinja i sala ostaju usklađeni — Denis pomaže za stolom. KassenSichV. 0 € / mesec.",
  },
  nav: {
    platform: "Platforma",
    enterprise: "Enterprise",
    pricing: "Cene",
    faq: "FAQ",
    signIn: "Prijava",
    cta: "Probaj besplatno",
  },
  hero: {
    eyebrow: "Denis · Part of Vera Group",
    title: "Denis — AI konobar",
    titleAccent: " koji nikad ne spava.",
    lead:
      "Gosti skeniraju, naručuju i plaćaju za stolom. Denis zna meni, alergene i ritam servisa — bez aplikacije.",
    cta: "Probaj besplatno",
    ctaSecondary: "Live demo",
    meta: "0 € / mesec · KassenSichV · Live za manje od 30 minuta",
    demoLabel: "Uživo — Denis za stolom",
  },
  trust: "Pouzdano u ugostiteljstvu · Integracije i compliance",
  features: [
    {
      id: "features-guest",
      eyebrow: "Narudžbina gostiju",
      title: "Skeniraj, naruči, plati — bez aplikacije",
      lead: "Gosti naručuju sa telefona za sekunde. Kartica, split račun i kontekst stola uključeni.",
      bullets: [
        "QR meni sa live dostupnošću i modifikatorima",
        "Stripe Connect checkout za stolom",
        "Split bill i praćenje narudžbine u jednom toku",
      ],
    },
    {
      id: "features-kitchen",
      eyebrow: "Kuhinja i bar",
      title: "Svaka narudžbina odmah stiže na pravu stanicu",
      lead: "KDS, bar routing i live table — bez papira i propuštenih fire-ova.",
      bullets: [
        "Prep display sa kontrastnim tiketima",
        "Live order board za salu i bar",
        "Status se automatski vraća gostima",
      ],
      reverse: true,
    },
    {
      id: "features-staff",
      eyebrow: "Koordinacija osoblja",
      title: "Upravljaj salom iz jednog cockpit-a",
      lead: "Stolovi, pozivi konobara, promet i brze akcije — brzina servisa, ne dashboard šum.",
      bullets: [
        "Zonski table board sa live sumama sesije",
        "Pozivi konobara i istorija narudžbina u jednoj shell-i",
        "Promet i floor snapshot odmah vidljivi",
      ],
    },
    {
      id: "features-denis",
      eyebrow: "Inteligencija i compliance",
      title: "Ugrađena inteligencija — ne chatbot trik",
      lead: "Denis tiho pomaže gostima i timu — preporuke, narudžbina i nemačka fiskalna usklađenost.",
      bullets: [
        "Strukturisan concierge panel — ne iMessage mehurići",
        "Pay-as-you-go AI krediti — 1 kredit po poruci",
        "KassenSichV, TSE, DATEV export uključeni",
        "Preporuke sa svesti o alergenima za stolom",
      ],
      reverse: true,
    },
  ],
  social: {
    eyebrow: "Social proof",
    title: "Restorani koji koriste Denis",
    lead: "Merljiv uticaj na promet, brzinu i usklađenost.",
    stats: [
      { value: 1000, suffix: "+", label: "Obrađenih narudžbina" },
      { value: 30, suffix: "s", prefix: "<", label: "Vreme narudžbine gosta" },
      { value: 99.9, suffix: "%", label: "Cilj uptime-a" },
      { value: 24, suffix: "/7", label: "Narudžbina gostiju" },
    ],
    testimonials: [
      {
        quote:
          "Denis deluje kao operativni softver — ne digitalni meni sa plaćanjem.",
        name: "Šef operacija",
        role: "Multi-concept grupa · 6 lokacija",
      },
      {
        quote: "Upsell preko Denisa je osetan, a gosti ne osećaju chatbot.",
        name: "Menadžer restorana",
        role: "Fine dining · Hamburg",
      },
    ],
  },
  pricing: {
    ...copyEn.pricing,
    eyebrow: "Cene",
    title: "Transparentne cene",
    lead: "Bez mesečne naknade na Standard planu. Jasna provizija preko Stripe-a.",
    popular: "Najpopularnije",
    roiTitle: "Izračunaj ROI",
    roiLead: "Proceni Denis uplift za tvoj lokal.",
    roiCovers: "Gostiju dnevno",
    roiTicket: "Prosečan račun (€)",
    roiUplift: "Upsell uplift (%)",
    roiResult: "Procena mesečnog uplift-a",
    compareTitle: "Poređenje planova",
    plans: [
      {
        name: "Standard",
        price: "€0",
        period: "/ mesec",
        fee: "Mala provizija po kartičnom plaćanju",
        description: "Puna platforma. Plaćate samo kad gosti plate karticom.",
        features: [
          "QR meni i live narudžbina",
          "KDS i poziv konobara",
          "Stripe Connect",
          "Analitika i CSV export",
          "Denis AI opciono (pay-as-you-go)",
        ],
        cta: "Probaj besplatno",
        href: "/signup",
        primary: true,
        complianceNote: "KassenSichV · GDPR · DATEV · TSE",
      },
      {
        name: "Growth",
        price: "€49",
        period: "/ mesec",
        fee: "Uključeno 2.000 Denis kredita / mesec",
        description: "Za pune smene sa aktivnim Denis concierge-om.",
        features: [
          "Sve iz Standard",
          "Denis krediti uključeni",
          "Proactive nudges i pairings",
          "Priority email podrška",
          "Multi-zone floor board",
        ],
        cta: "Izaberi Growth",
        href: "/signup?plan=growth",
        primary: false,
      },
      {
        name: "Enterprise",
        price: "Po dogovoru",
        period: "",
        fee: "Volume cene i onboarding",
        description: "Lanac, hotel F&B i high-volume lokali.",
        features: [
          "Sve iz Growth",
          "Multi-location rollout",
          "API i white-label",
          "SLA i account manager",
          "Custom integracije",
        ],
        cta: "Kontaktiraj sales",
        href: "/enterprise",
        primary: false,
        complianceNote: "KassenSichV · DATEV · TSE",
      },
    ],
    featureMatrix: {
      headers: ["Standard", "Growth", "Enterprise"],
      rows: [
        { label: "QR narudžbina i KDS", values: [true, true, true] },
        { label: "Denis AI concierge", values: [true, true, true] },
        { label: "Uključeni Denis krediti", values: [false, true, true] },
        { label: "Multi-location", values: [false, false, true] },
        { label: "API / white-label", values: [false, false, true] },
      ],
    },
  },
  enterprise: {
    eyebrow: "Enterprise",
    title: "Infrastruktura za hospitality grupe",
    lead: "Multi-location, API, white-label i dedicirani onboarding.",
    pillars: copySrPricingPillars(),
    caseStudies: [
      {
        venue: "Skyline Lounge · 120 mesta",
        result: "+18% prosečan račun posle 6 nedelja",
        quote: "Sala vidi korpe ranije — gosti ne čekaju konobara.",
      },
      {
        venue: "Hotel F&B · 4 outlet-a",
        result: "Jedan dashboard za sve lokacije",
        quote: "Rollout za tri nedelje umesto tri meseca.",
      },
    ],
    cta: "Enterprise upit",
    ctaSecondary: "Kreni sa Standard",
  },
  faq: {
    title: "FAQ",
    lead: "Najvažnija pitanja operatera.",
    items: [
      {
        q: "Da li je Denis KassenSichV usklađen?",
        a: "Da. Svaka transakcija TSE potpis. DATEV export uključen.",
      },
      {
        q: "Da li gosti trebaju aplikaciju?",
        a: "Ne. QR sken, narudžbina u browseru.",
      },
      {
        q: "Kako radi podela računa?",
        a: "Po stavkama ili ravnomerno — svako plaća posebno.",
      },
      {
        q: "Koliko košta Denis?",
        a: "0 € platforma na Standard. Kartica preko Stripe. Denis AI opciono.",
      },
      {
        q: "Koliko brzo mogu biti live?",
        a: "Ispod 30 minuta: nalog, meni, QR kodovi.",
      },
      {
        q: "POS integracija?",
        a: "Deliverect, Orderbird, Lightspeed — pišite nam za vaš setup.",
      },
    ],
  },
  ctaBanner: {
    title: "Vaši gosti su spremni. A vi?",
    lead: "Pokrenite pilot — bez kartice. Live za manje od 30 minuta.",
    primary: "Probaj besplatno",
    secondary: "Live demo",
    footnote: "Razvijeno u Hamburgu",
  },
  footer: {
    tagline:
      "Denis — hospitality OS za narudžbinu, kuhinju, plaćanje i compliance.",
    copyright: "© 2026 Vera Group · Hamburg, Nemačka",
  },
};

function copySrPricingPillars(): LandingCopy["enterprise"]["pillars"] {
  return [
    {
      title: "Multi-location governance",
      description: "Organizacije, lokacije, zone — jedna hijerarhija.",
    },
    {
      title: "API i integracije",
      description: "Deliverect, POS mostovi i webhook-ovi.",
    },
    {
      title: "White-label",
      description: "Vaš brend na guest i staff površinama.",
    },
  ];
}

export const LANDING_COPY: Record<LandingLocale, LandingCopy> = {
  de: copyDe,
  en: copyEn,
  sr: copySr,
};

export function resolveLandingLocale(input?: string | null): LandingLocale {
  const raw = (input ?? "en").trim().toLowerCase().slice(0, 2);
  if (raw === "de" || raw === "sr") return raw;
  return "en";
}

export function landingCopy(locale: LandingLocale): LandingCopy {
  return LANDING_COPY[locale];
}
