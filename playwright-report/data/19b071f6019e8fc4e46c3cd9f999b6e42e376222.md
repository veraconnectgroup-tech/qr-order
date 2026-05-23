# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: landing.spec.ts >> Landing page >> footer legal links use correct URLs
- Location: e2e/landing.spec.ts:36:7

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: getByRole('contentinfo').getByRole('link', { name: 'Datenschutz' })
Expected: "/datenschutz"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByRole('contentinfo').getByRole('link', { name: 'Datenschutz' })

```

```yaml
- banner:
  - link "QR Order":
    - /url: /
  - navigation:
    - link "Platform":
      - /url: "#modules"
    - link "Enterprise":
      - /url: /enterprise
    - link "Pricing":
      - /url: "#pricing"
    - link "Demo":
      - /url: /skyline-lounge/demo-table-8
  - link "Log in":
    - /url: /login
  - link "Request access":
    - /url: /signup
- main:
  - paragraph: Hospitality OS
  - heading "The operating system for modern hospitality." [level=1]
  - paragraph: QR ordering, live kitchen ops, table management, and Stripe payments — unified in one platform. Built for restaurants, bars, and hotel F&B in Germany.
  - link "Start free":
    - /url: /signup
  - link "See live demo →":
    - /url: /skyline-lounge/demo-table-8
  - paragraph: Used by early operators across Germany · 0€/month · Live in < 30 min
  - text: app.qr-order.com/dashboard/orders
  - complementary:
    - paragraph: Skyline Lounge
    - text: Open
    - navigation: Orders Prep Display Tables Waiter Calls History Menu Settings
  - heading "Live Orders" [level=1]
  - text: Today 51,78 €
  - main:
    - paragraph: Live Orders
    - text: ● Live
    - paragraph: New
    - article:
      - paragraph: "#047"
      - text: 2:03 Table 8 Rooftop
      - list:
        - listitem: 2× Aperol Spritz
        - listitem: 1× Hugo Spritz
      - text: MwSt 19% 5,51 € 44,63 € Paid ✓
      - paragraph: Online payment · 44,63 €
      - button "Reject" [disabled]
      - button "Accept ►" [disabled]
    - paragraph: Preparing
    - article:
      - paragraph: "#046"
      - text: 5:03 VIP 2 Lounge
      - list:
        - listitem: 2× Negroni
        - listitem: 1× Nachos
      - text: MwSt 19% 6,65 € 38,08 € Paid ✓
      - paragraph: Online payment · 38,08 €
      - button "Start Preparing" [disabled]
    - paragraph: Ready
    - article:
      - paragraph: "#044"
      - text: 11:03 Table 3 Terrace
      - list:
        - listitem: 2× Truffle Fries
      - text: MwSt 19% 3,23 € 20,23 € Paid ✓
      - paragraph: Online payment · 20,23 €
      - button "Mark Delivered" [disabled]
  - text: S
  - paragraph: Skyline Lounge
  - paragraph: Rooftop · Hamburg
  - text: Table 8 Drinks Food Desserts
  - paragraph: Cocktails (2)
  - article:
    - text: 5m
    - paragraph: Aperol Spritz
    - text: 9,50 € +
  - article:
    - text: 5m
    - paragraph: Negroni
    - text: 12,00 € +
  - text: 3 items Cart → 33,50 €
  - region "Integrations and compliance":
    - paragraph: Integrations & compliance
    - list:
      - listitem "Stripe": stripe
      - listitem "Apple Pay": Pay
      - listitem "Google Pay": G o o g l e Pay
      - listitem "KassenSichV"
      - listitem "DSGVO"
      - listitem "DATEV"
  - paragraph: Why QR Order
  - heading "From duct tape to one platform" [level=2]
  - paragraph: Hospitality runs on duct tape.
  - list:
    - listitem: 4 tools for orders, kitchen, payments, analytics
    - listitem: Paper tickets lost between bar and kitchen
    - listitem: Guests waiting 10 min just to pay
  - paragraph: One platform. Zero friction.
  - list:
    - listitem: Unified dashboard — QR scan to DATEV export
    - listitem: Real-time kitchen display with sound alerts
    - listitem: Guests pay at table in 15 seconds
  - heading "Every module your venue needs" [level=2]
  - paragraph: Run guest ordering, floor ops, kitchen, and payments without opening four different tools.
  - button "All"
  - button "Guest"
  - button "Operations"
  - button "Payments"
  - heading "QR guest menus" [level=3]
  - paragraph: Scan to open a mobile-native menu — modifiers, serve sizes, live status.
  - heading "Session ordering" [level=3]
  - paragraph: Guests add to a table session bill without creating an account.
  - text: T1 T2 T3 T4 T5 T6 T7 T8
  - heading "Floor board" [level=3]
  - paragraph: Zones, tables, QR codes, session totals, and attention states.
  - text: 8 3 B1
  - heading "Kitchen display" [level=3]
  - paragraph: Prep line with timers and large tap targets for peak service.
  - text: Table 8 · Call Table 3 · Bill
  - heading "Waiter calls" [level=3]
  - paragraph: Guests request staff from the table — hosts see it instantly.
  - text: Stripe Connect
  - heading "Stripe Connect" [level=3]
  - paragraph: Card payments routed to each venue with clear per-order fees.
  - text: Bar Table Card
  - heading "Pay in person" [level=3]
  - paragraph: Bar, counter, or table checkout — configured per location.
  - text: Part 1 €14 Part 2 €14 Part 3 €14
  - heading "Split bill" [level=3]
  - paragraph: Guests divide the check equally or by items — each pays their share.
  - text: 0% 5% 10% 15% Trinkgeld · MwSt-frei
  - heading "Digital tips" [level=3]
  - paragraph: MwSt-free tips at checkout — routed to assigned staff automatically.
  - heading "Analytics & export" [level=3]
  - paragraph: Daily revenue, filters, and CSV export for finance teams.
  - paragraph:
    - text: Plus staff roles, multi-location, and enterprise rollout →
    - link "Explore enterprise":
      - /url: /enterprise
  - text: Product tour
  - heading "Built for every role on the floor" [level=2]
  - paragraph: Guest ordering, live ops, kitchen sync, and payments — where your team already works.
  - navigation "Product views":
    - button "Guest"
    - button "Floor"
    - button "Kitchen"
    - button "Payments"
    - button "Analytics"
  - paragraph: Guest
  - heading "Ordering without friction" [level=3]
  - list:
    - listitem: QR scan opens menu — no app download
    - listitem: Modifiers, serve sizes, and live order status
    - listitem: Session bill across multiple rounds
    - listitem: Pay at table in under 15 seconds
  - text: S
  - paragraph: Skyline Lounge
  - paragraph: Rooftop · Hamburg
  - text: Table 8 Drinks Food Desserts
  - paragraph: Cocktails (2)
  - article:
    - text: 5m
    - paragraph: Aperol Spritz
    - text: 9,50 € +
  - article:
    - text: 5m
    - paragraph: Negroni
    - text: 12,00 € +
  - text: 3 items Cart → 33,50 €
  - heading "Built for real service" [level=2]
  - paragraph: Numbers that matter to operators.
  - paragraph: < 30s
  - paragraph: Average guest order time
  - paragraph: 0€
  - paragraph: Monthly platform fee
  - paragraph: 99.9%
  - paragraph: Uptime SLA target
  - paragraph: 2 min
  - paragraph: Setup to first order
  - paragraph: Real operator feedback coming soon. Request access to join our pilot program.
  - heading "Live in three steps" [level=2]
  - paragraph: From signup to first guest order in under two minutes.
  - text: "1"
  - heading "Sign up & add your menu" [level=3]
  - paragraph: Create your account, upload your menu with categories, modifiers and photos.
  - text: "2"
  - heading "Print QR codes for tables" [level=3]
  - paragraph: Generate and print QR codes. Each table gets its own code.
  - text: "3"
  - heading "Guests scan, order, pay" [level=3]
  - paragraph: No app download. Guests browse, order and pay from their phone.
  - paragraph: Pricing
  - heading "Transparent economics" [level=2]
  - paragraph: No monthly platform fee on Standard. Card processing via Stripe with a clear per-order fee.
  - paragraph: Standard
  - text: €0 / month
  - paragraph: €0.20 per order under €10, €0.40 per order from €10 upward
  - paragraph: Full platform. Pay only when guests pay by card.
  - list:
    - listitem: QR guest menus & live orders
    - listitem: Kitchen display & waiter calls
    - listitem: Stripe Connect card payments
    - listitem: Bar, counter & table payment options
    - listitem: Analytics & CSV export
    - listitem: Staff invites & roles
  - link "Request access":
    - /url: /signup
  - paragraph: Enterprise
  - text: Custom
  - paragraph: Volume pricing & dedicated onboarding
  - paragraph: For chains, hotel F&B, and high-volume venues.
  - list:
    - listitem: Everything in Standard
    - listitem: Multi-location rollout support
    - listitem: Custom integrations
    - listitem: Priority support & SLA options
    - listitem: Dedicated success contact
  - paragraph: KassenSichV • DATEV • TSE included
  - link "Contact sales":
    - /url: /enterprise
  - heading "Häufige Fragen" [level=2]
  - paragraph: Antworten für Betreiber, die QR-Bestellung evaluieren.
  - link "Team kontaktieren →":
    - /url: mailto:hello@qrorder.app
  - group: Ist QR Order KassenSichV-konform?
  - group: Brauchen Gäste eine App?
  - group: Wie funktioniert Split Bill?
  - group: Was kostet QR Order?
  - group: Wie schnell kann ich starten?
  - heading "Your guests are ready. Are you?" [level=2]
  - paragraph: Join our pilot program — no credit card needed.
  - link "Request access":
    - /url: /signup
  - paragraph: 🇩🇪 Made in Hamburg
  - link "QR Order":
    - /url: /
  - paragraph: Guest ordering, live operations, and payments for restaurants, bars, and hospitality groups.
  - heading "Product" [level=4]
  - list:
    - listitem:
      - link "Platform":
        - /url: /#product
    - listitem:
      - link "Enterprise":
        - /url: /enterprise
    - listitem:
      - link "Pricing":
        - /url: /#pricing
    - listitem:
      - link "Live demo":
        - /url: /skyline-lounge/demo-table-8
  - heading "Company" [level=4]
  - list:
    - listitem:
      - link "Contact":
        - /url: mailto:hello@qrorder.app
    - listitem:
      - link "FAQ":
        - /url: /#faq
    - listitem:
      - link "Sign in":
        - /url: /login
    - listitem:
      - link "Request access":
        - /url: /signup
  - heading "Legal" [level=4]
  - list:
    - listitem:
      - link "Datenschutz":
        - /url: /datenschutz
    - listitem:
      - link "AGB":
        - /url: /agb
    - listitem:
      - link "Impressum":
        - /url: /impressum
  - text: Built with Next.js · Stripe · Supabase · Vercel
  - paragraph: © 2026 QR Order · Hamburg, Germany
  - paragraph: Payments powered by Stripe Connect
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test.describe("Landing page", () => {
  4  |   test("shows hero section", async ({ page }) => {
  5  |     await page.goto("/");
  6  | 
  7  |     await expect(
  8  |       page.getByRole("heading", {
  9  |         name: /operating system for modern hospitality/i,
  10 |       })
  11 |     ).toBeVisible();
  12 |   });
  13 | 
  14 |   test("nav links point to platform, enterprise, and pricing", async ({ page }) => {
  15 |     await page.goto("/");
  16 | 
  17 |     const headerNav = page.getByRole("banner").getByRole("navigation");
  18 | 
  19 |     await expect(headerNav.getByRole("link", { name: "Platform" })).toHaveAttribute(
  20 |       "href",
  21 |       "#modules"
  22 |     );
  23 |     await expect(headerNav.getByRole("link", { name: "Enterprise" })).toHaveAttribute(
  24 |       "href",
  25 |       "/enterprise"
  26 |     );
  27 |     await expect(headerNav.getByRole("link", { name: "Pricing" })).toHaveAttribute(
  28 |       "href",
  29 |       "#pricing"
  30 |     );
  31 | 
  32 |     await headerNav.getByRole("link", { name: "Enterprise" }).click();
  33 |     await expect(page).toHaveURL(/\/enterprise$/);
  34 |   });
  35 | 
  36 |   test("footer legal links use correct URLs", async ({ page }) => {
  37 |     await page.goto("/");
  38 | 
  39 |     const footer = page.getByRole("contentinfo");
> 40 |     await expect(footer.getByRole("link", { name: "Datenschutz" })).toHaveAttribute(
     |                                                                     ^ Error: expect(locator).toHaveAttribute(expected) failed
  41 |       "href",
  42 |       "/datenschutz"
  43 |     );
  44 |     await expect(footer.getByRole("link", { name: "AGB" })).toHaveAttribute(
  45 |       "href",
  46 |       "/agb"
  47 |     );
  48 |     await expect(footer.getByRole("link", { name: "Impressum" })).toHaveAttribute(
  49 |       "href",
  50 |       "/impressum"
  51 |     );
  52 |   });
  53 | });
  54 | 
```