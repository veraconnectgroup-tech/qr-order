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
  trust: {
    eyebrow: string;
    headline: string;
    headlineAccent: string;
    lead: string;
    groups: {
      payments: string;
      fiscal: string;
      privacy: string;
      finance: string;
    };
  };
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
    title: "Denis — KI Restaurant Co-worker · Vera Group",
    description:
      "QR-Bestellung, Stripe-Zahlung, Küche, Bar und Service in einem Live-Brain. Denis hält jeden offenen Tisch im Blick.",
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
    eyebrow: "Denis · AI Restaurant Co-worker",
    title: "Denis führt die Schicht",
    titleAccent: " von QR bis Zahlung.",
    lead:
      "Gäste bestellen per QR. Service, Küche und Bar sehen den gleichen Stand. Denis erkennt, was hängt, wer reagieren muss und welche Aktion den Tisch weiterbringt.",
    cta: "Kostenlos testen",
    ctaSecondary: "Live-Demo",
    meta: "QR Ordering · Stripe Zahlung · Station Truth · KassenSichV",
    demoLabel: "Live — Denis Shift Brain",
  },
  trust: {
    eyebrow: "Vertraut in Gastronomie",
    headline: "Für die ganze Schicht gebaut —",
    headlineAccent: "keine Logo-Mauer.",
    lead:
      "Gastzahlungen, TSE-Signatur, DSGVO und DATEV-Export hängen an einer operativen Spine. Denis liefert, was deutsche Gastronomie wirklich braucht.",
    groups: {
      payments: "Einzug",
      fiscal: "Signieren",
      privacy: "Schützen",
      finance: "Export",
    },
  },
  features: [
    {
      id: "features-guest",
      eyebrow: "Gast-Bestellung",
      title: "Vom QR-Code bis zur Zahlung ohne Reibung",
      lead: "Denis begleitet den Gast durch Menü, Empfehlung, Bestellung, Split Bill und Zahlung — direkt im Browser.",
      bullets: [
        "QR-Menü mit Live-Verfügbarkeit, Allergenen und Modifikatoren",
        "Stripe Connect Checkout, Split Bill und Zahlungsstatus",
        "Gast bekommt nur Aussagen, die Denis operativ belegen kann",
      ],
    },
    {
      id: "features-kitchen",
      eyebrow: "Küche & Bar",
      title: "Bar und Küche laufen getrennt, aber synchron",
      lead: "Denis weiß, ob Getränke fertig sind, Essen noch läuft oder der Service die fertige Station nicht abgeholt hat.",
      bullets: [
        "Per-Station Status für Bar, Küche und Service-Handoff",
        "Ready-not-picked-up wird sichtbar, bevor Gäste unruhig werden",
        "Status fließt präzise zurück zu Gästen und Team",
      ],
      reverse: true,
    },
    {
      id: "features-staff",
      eyebrow: "Service-Koordination",
      title: "Jeder Kellner bekommt einen zweiten Kopf",
      lead: "Das Team kann Denis fragen, was mit Tisch, Bestellung, Küche, Bar oder Zahlung los ist — ohne zur Station zu laufen.",
      bullets: [
        "Staff Ask Denis für erlaubte Tisch- und Order-Fragen",
        "Priorisierte Aufgaben statt Notification-Lärm",
        "Operations Center zeigt nur, was jetzt brennt",
      ],
    },
    {
      id: "features-denis",
      eyebrow: "Intelligence & Compliance",
      title: "Die nächste beste Aktion für jeden offenen Tisch",
      lead: "Denis verkauft nicht blind. Erst Service stabilisieren, dann ehrlich informieren, dann Getränke, Dessert oder Kaffee im richtigen Moment vorschlagen.",
      bullets: [
        "Table Brain für Stimmung, Risiko und nächsten Schritt",
        "Capacity-aware Empfehlungen: kein Dessert, wenn die Küche brennt",
        "KassenSichV, TSE, DATEV-Export inklusive",
        "Audit-Timeline für Orders, Fragen, Eskalationen und Zahlungen",
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
    title: "Starte mit 30.000 kostenlosen Credits.",
    lead: "Denis im Pilot kostenlos testen. Danach klare Pläne ab €49 pro Monat.",
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
    title: "Denis — AI Restaurant Co-worker · Vera Group",
    description:
      "QR ordering, Stripe payments, kitchen, bar, and service in one live brain. Denis watches every open table.",
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
    eyebrow: "Denis · AI Restaurant Co-worker",
    title: "Denis runs the shift",
    titleAccent: " from QR to payment.",
    lead:
      "Guests order by QR. Staff, kitchen, and bar share the same truth. Denis spots what is stuck, who should act, and the next move for every open table.",
    cta: "Try for free",
    ctaSecondary: "Live demo",
    meta: "QR ordering · Stripe payments · Station truth · KassenSichV",
    demoLabel: "Live — Denis shift brain",
  },
  trust: {
    eyebrow: "Trusted in hospitality",
    headline: "Built for the full shift —",
    headlineAccent: "not a logo wall.",
    lead:
      "Guest payments, TSE signing, GDPR, and DATEV export connect as one operational spine. Denis ships with what German hospitality actually needs.",
    groups: {
      payments: "Collect",
      fiscal: "Certify",
      privacy: "Protect",
      finance: "Export",
    },
  },
  features: [
    {
      id: "features-guest",
      eyebrow: "Guest ordering",
      title: "From QR code to payment without confusion",
      lead: "Denis guides the guest through menu questions, recommendations, ordering, split bills, and payment in the browser.",
      bullets: [
        "QR menu with live availability, allergens, and modifiers",
        "Stripe Connect checkout, split bill, and payment status",
        "Guests only hear what Denis can prove from live operations",
      ],
    },
    {
      id: "features-kitchen",
      eyebrow: "Kitchen & bar sync",
      title: "Bar and kitchen stay separate, but synchronized",
      lead: "Denis knows when drinks are ready, food is still in prep, or the waiter has not picked up a completed station.",
      bullets: [
        "Per-station status for bar, kitchen, and service handoff",
        "Ready-not-picked-up becomes visible before guests get frustrated",
        "Precise status flows back to guests and staff",
      ],
      reverse: true,
    },
    {
      id: "features-staff",
      eyebrow: "Staff coordination",
      title: "Every waiter gets a second brain",
      lead: "Staff can ask Denis what is happening with a table, order, kitchen station, bar ticket, or payment without walking away.",
      bullets: [
        "Staff Ask Denis for permitted table and order questions",
        "Prioritized actions instead of notification noise",
        "Operations Center shows only what is burning now",
      ],
    },
    {
      id: "features-denis",
      eyebrow: "Intelligence & compliance",
      title: "The next best action for every open table",
      lead: "Denis does not upsell blindly. Stabilize service first, tell the guest the truth, then suggest drinks, dessert, or coffee at the right moment.",
      bullets: [
        "Table Brain for mood, risk, and next step",
        "Capacity-aware recommendations: no dessert push when kitchen is burning",
        "KassenSichV, TSE, DATEV export included",
        "Audit timeline for orders, questions, escalations, and payments",
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
    title: "Start with 30,000 free credits.",
    lead: "Put Denis to work for free during your pilot. Then clear plans from €49 per month.",
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
    title: "Denis — AI Restaurant Co-worker · Vera Group",
    description:
      "QR naručivanje, Stripe plaćanje, kuhinja, bar i sala u jednom živom mozgu. Denis prati svaki otvoren sto.",
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
    eyebrow: "Denis · AI Restaurant Co-worker",
    title: "Denis vodi smenu",
    titleAccent: " od QR-a do plaćanja.",
    lead:
      "Gosti naručuju preko QR-a. Konobari, kuhinja i bar dele istu istinu. Denis vidi šta stoji, ko treba da reaguje i koji je sledeći potez za svaki otvoren sto.",
    cta: "Probaj besplatno",
    ctaSecondary: "Live demo",
    meta: "QR naručivanje · Stripe plaćanje · Station truth · KassenSichV",
    demoLabel: "Uživo — Denis shift brain",
  },
  trust: {
    eyebrow: "Pouzdano u ugostiteljstvu",
    headline: "Za celu smenu —",
    headlineAccent: "ne zid logotipa.",
    lead:
      "Plaćanja gostiju, TSE potpis, GDPR i DATEV izvoz povezani su u jednu operativnu spine. Denis donosi ono što nemačko ugostiteljstvo zaista treba.",
    groups: {
      payments: "Naplata",
      fiscal: "Potpis",
      privacy: "Zaštita",
      finance: "Izvoz",
    },
  },
  features: [
    {
      id: "features-guest",
      eyebrow: "Narudžbina gostiju",
      title: "Od QR koda do plaćanja bez konfuzije",
      lead: "Denis vodi gosta kroz meni, preporuke, narudžbinu, podelu računa i plaćanje direktno u browseru.",
      bullets: [
        "QR meni sa live dostupnošću, alergenima i modifikatorima",
        "Stripe Connect checkout, split bill i status plaćanja",
        "Gost čuje samo ono što Denis može da dokaže iz operacije",
      ],
    },
    {
      id: "features-kitchen",
      eyebrow: "Kuhinja i bar",
      title: "Bar i kuhinja su odvojeni, ali sinhronizovani",
      lead: "Denis zna da je piće spremno, hrana još u pripremi ili da konobar nije preuzeo spremnu stanicu.",
      bullets: [
        "Status po stanici za bar, kuhinju i handoff konobaru",
        "Spremno a nepreuzeto postaje vidljivo pre nego što gost pukne",
        "Precizan status ide nazad gostu i osoblju",
      ],
      reverse: true,
    },
    {
      id: "features-staff",
      eyebrow: "Koordinacija osoblja",
      title: "Svaki konobar dobija drugi mozak",
      lead: "Osoblje može da pita Denisa šta se dešava sa stolom, porudžbinom, kuhinjom, barom ili plaćanjem bez odlaska do stanice.",
      bullets: [
        "Staff Ask Denis za dozvoljena pitanja o stolu i porudžbini",
        "Prioritetne akcije umesto buke notifikacija",
        "Operations Center prikazuje samo šta trenutno gori",
      ],
    },
    {
      id: "features-denis",
      eyebrow: "Inteligencija i compliance",
      title: "Sledeća najbolja akcija za svaki otvoren sto",
      lead: "Denis ne prodaje naslepo. Prvo stabilizuje servis, zatim gostu kaže istinu, pa tek onda predloži piće, desert ili kafu u pravom trenutku.",
      bullets: [
        "Table Brain za raspoloženje, rizik i sledeći korak",
        "Preporuke po kapacitetu: nema desert push-a kad kuhinja gori",
        "KassenSichV, TSE, DATEV export uključeni",
        "Audit timeline za porudžbine, pitanja, eskalacije i plaćanja",
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
    title: "Počni sa 30.000 besplatnih kredita.",
    lead: "Pusti Denisa da radi besplatno tokom pilota. Posle toga jasni planovi od €49 mesečno.",
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
