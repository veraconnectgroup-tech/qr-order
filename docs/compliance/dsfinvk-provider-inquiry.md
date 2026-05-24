# DSFinV-K — Provider inquiry (draft emails)

> **Status:** Draft — **do not send** until Jovica approves.  
> **Blocks:** ADR-001 Track B5 (DSFinV-K export implementation).

---

## Context for providers

QR Order operates in two fiscal modes (ADR-001 §8):

1. **Standalone Kasse** — QR Order uses **fiskaly Cloud TSE** for transaction signing (KassenSichV). We need DSFinV-K export for tax audit from our system.
2. **Vorsystem** — External POS is the fiscal Kasse; QR Order has no DSFinV-K obligation.

This inquiry concerns **standalone mode only**.

**Product:** B2B SaaS — multi-location hospitality ordering (DE/DACH).  
**Stack:** Next.js, PostgreSQL, fiskaly API (TSE signing already integrated).  
**Ask:** Official export path / API / tooling for DSFinV-K compliant export when using fiskaly Cloud TSE.

---

## Email 1 — fiskaly

**To:** support@fiskaly.com (or partner contact if available)  
**Subject:** DSFinV-K export guidance — Cloud TSE integration (QR Order SaaS)

```
Hello fiskaly team,

We operate QR Order, a multi-location ordering platform for hospitality venues 
in Germany. We integrate fiskaly Cloud TSE for standalone locations where 
QR Order acts as the Registrierkasse (KassenSichV).

TSE transaction signing via your API is already implemented. We are planning 
DSFinV-K export for tax audit compliance and would like your guidance:

1. What is the recommended approach to generate DSFinV-K exports when using 
   fiskaly Cloud TSE? (API endpoint, SIGN DE product, third-party tool?)
2. Is DSFinV-K export included in SIGN DE / KassenSichV bundle, or separate?
3. Are there reference implementations, schemas, or documentation you can share?
4. Any timeline or certification requirements we should plan for?

Our technical stack: Node.js/TypeScript, PostgreSQL, per-organization TSS/client 
IDs stored on organizations.fiskaly_tss_id / fiskaly_client_id.

Happy to provide more detail or jump on a short call.

Best regards,
[Name]
QR Order
[email]
[website]
```

---

## Email 2 — fiskaltrust

**To:** info@fiskaltrust.de (or technical contact)  
**Subject:** DSFinV-K export — inquiry from QR Order (Cloud TSE via fiskaly)

```
Guten Tag,

wir betreiben QR Order, eine Bestellplattform für Gastronomiebetriebe in 
Deutschland. Für Standalone-Standorte (QR Order als Kasse) nutzen wir 
fiskaly Cloud TSE zur Transaktionssignierung.

Für die DSFinV-K-Compliance benötigen wir Klarheit über den Exportpfad:

1. Empfehlen Sie für fiskaly Cloud TSE-Kunden eine bestimmte DSFinV-K-Lösung?
2. Bietet fiskaltrust Middleware/API für DSFinV-K-Export aus Cloud-TSE-Daten?
3. Gibt es Dokumentation oder Referenzintegrationen, die Sie teilen können?
4. Welche Schritte sind für einen SaaS-Anbieter (Multi-Tenant, viele Locations) 
   relevant?

Technischer Hintergrund: Node.js/PostgreSQL, fiskaly TSS/Client pro Organisation.

Vielen Dank im Voraus.

Mit freundlichen Grüßen
[Name]
QR Order
[email]
```

---

## After response — engineering checklist

- [ ] Document chosen export mechanism in ADR-001 §8.3
- [ ] Unblock B5 in roadmap
- [ ] Implement export job (likely separate from outbox — periodic/on-demand)
- [ ] Admin UI: DSFinV-K download per location/org/date range
- [ ] Legal review of export format before customer-facing release

---

## Approval

| Role | Name | Approved to send? | Date |
|------|------|-------------------|------|
| Product owner | Jovica | ☐ Pending | |
