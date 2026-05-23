# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: landing.spec.ts >> Landing page >> footer legal links use correct URLs
- Location: e2e/landing.spec.ts:32:7

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
  - heading "Your shortcut to every order." [level=1]
  - paragraph: A collection of powerful ordering tools — guest menus, live operations, kitchen flow, and payments — all within one platform. Fast, ergonomic, and reliable.
  - link "Request access":
    - /url: /signup
  - link "Live demo":
    - /url: /skyline-lounge/demo-table-8
  - paragraph: No guest app · Stripe Connect · Multi-location ready
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
      - text: 2:04 Table 8 Rooftop
      - list:
        - listitem: 2× Aperol Spritz
        - listitem: 1× Hugo Spritz
      - text: MwSt 19% 5,51 € 44,63 € Paid ✓
      - button "Reject" [disabled]
      - button "Accept ►" [disabled]
    - paragraph: Preparing
    - article:
      - paragraph: "#046"
      - text: 5:04 VIP 2 Lounge
      - list:
        - listitem: 2× Negroni
        - listitem: 1× Nachos
      - text: MwSt 19% 6,65 € 38,08 € Paid ✓
      - button "Start Preparing" [disabled]
    - paragraph: Ready
    - article:
      - paragraph: "#044"
      - text: 11:04 Table 3 Terrace
      - list:
        - listitem: 2× Truffle Fries
      - text: MwSt 19% 3,23 € 20,23 € Paid ✓
      - button "Mark Delivered" [disabled]
  - region "Platform trust signals":
    - list:
      - listitem: 🇩🇪 Made in Germany
      - listitem: KassenSichV / TSE
      - listitem: DSGVO konform
      - listitem: DATEV Export
      - listitem: Stripe Connect
  - paragraph: It's not about ordering faster.
  - paragraph: It's about running service without friction.
  - heading "There's a module for that." [level=2]
  - paragraph: Run guest ordering, floor ops, kitchen, and payments without opening four different tools.
  - button "All"
  - button "Guest"
  - button "Operations"
  - button "Payments"
  - heading "QR guest menus" [level=3]
  - paragraph: Scan to open a mobile-native menu — modifiers, serve sizes, live status.
  - heading "Session ordering" [level=3]
  - paragraph: Guests add to a table session bill without creating an account.
  - heading "Floor board" [level=3]
  - paragraph: Zones, tables, QR codes, session totals, and attention states.
  - heading "Kitchen display" [level=3]
  - paragraph: Prep line with timers and large tap targets for peak service.
  - heading "Waiter calls" [level=3]
  - paragraph: Guests request staff from the table — hosts see it instantly.
  - heading "Stripe Connect" [level=3]
  - paragraph: Card payments routed to each venue with clear per-order fees.
  - heading "Pay in person" [level=3]
  - paragraph: Bar, counter, or table checkout — configured per location.
  - heading "Analytics & export" [level=3]
  - paragraph: Daily revenue, filters, and CSV export for finance teams.
  - paragraph:
    - text: Plus staff roles, multi-location, and enterprise rollout →
    - link "Explore enterprise":
      - /url: /enterprise
  - text: Real-time ops
  - heading "Your floor just got smarter." [level=2]
  - paragraph: Live orders, kitchen sync, payment requests, and table sessions — where your team already works.
  - paragraph: Guest menu
  - heading "Ordering without friction" [level=3]
  - paragraph: Mobile-native menus with modifiers and live order status. Guests scan a QR code — no download required.
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
  - paragraph: Guest phone — scan & order
  - navigation "Product views":
    - button "Guest menu"
    - button "Floor"
    - button "Kitchen"
    - button "Payments"
    - button "Analytics"
  - paragraph: Feedback
  - heading "Early operators, real workflows" [level=2]
  - paragraph: Anonymized feedback from hospitality teams testing QR Order in production.
  - paragraph: “Finally an ordering system that understands German tax rules.”
  - paragraph: Early adopter feedback
  - paragraph: “Setup took 20 minutes. Staff needed zero training.”
  - paragraph: Early adopter feedback
  - paragraph: “Our guests love not having to wait for the waiter.”
  - paragraph: Early adopter feedback
  - heading "Don't repeat yourself." [level=2]
  - paragraph: Automate the workflows your team runs every service — session billing, QR deployment, and kitchen handoff.
  - paragraph: Table 8 · Session
  - paragraph: €47.50
  - paragraph: 3 items · Pay at table
  - heading "Session bills" [level=3]
  - paragraph: Guests order across the night on one table session. Pay online or in person — bar, counter, or table.
  - text: QR
  - paragraph: Table 12
  - heading "QR at every table" [level=3]
  - paragraph: Generate and print QR codes per table. Guests land on your menu in under a second.
  - paragraph: "#1042"
  - paragraph: Preparing · 6 min
  - heading "Kitchen in sync" [level=3]
  - paragraph: Accepted orders hit the prep display instantly. Floor and kitchen share one live state.
  - link "Request access →":
    - /url: /signup
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
  - paragraph: FAQ
  - heading "Questions operators ask before rollout" [level=2]
  - paragraph: Straight answers for owners, GMs, and ops leads evaluating QR ordering.
  - link "Talk to our team →":
    - /url: mailto:hello@qrorder.app
  - button "Do guests need to download an app?"
  - paragraph: No. Guests scan a QR code and order in the mobile browser. No account required for ordering.
  - button "How do you handle payments?"
  - button "Can we run multiple locations?"
  - button "What does pricing look like?"
  - button "How fast can we go live?"
  - heading "Take the short way." [level=2]
  - paragraph: Request access and run your first service on QR Order.
  - link "Request access":
    - /url: /signup
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
  8  |       page.getByRole("heading", { name: /your shortcut to every order/i })
  9  |     ).toBeVisible();
  10 |   });
  11 | 
  12 |   test("nav links point to platform, enterprise, and pricing", async ({ page }) => {
  13 |     await page.goto("/");
  14 | 
  15 |     await expect(page.getByRole("navigation").getByRole("link", { name: "Platform" })).toHaveAttribute(
  16 |       "href",
  17 |       "#modules"
  18 |     );
  19 |     await expect(page.getByRole("navigation").getByRole("link", { name: "Enterprise" })).toHaveAttribute(
  20 |       "href",
  21 |       "/enterprise"
  22 |     );
  23 |     await expect(page.getByRole("navigation").getByRole("link", { name: "Pricing" })).toHaveAttribute(
  24 |       "href",
  25 |       "#pricing"
  26 |     );
  27 | 
  28 |     await page.getByRole("navigation").getByRole("link", { name: "Enterprise" }).click();
  29 |     await expect(page).toHaveURL(/\/enterprise$/);
  30 |   });
  31 | 
  32 |   test("footer legal links use correct URLs", async ({ page }) => {
  33 |     await page.goto("/");
  34 | 
  35 |     const footer = page.getByRole("contentinfo");
  36 | 
> 37 |     await expect(footer.getByRole("link", { name: "Datenschutz" })).toHaveAttribute(
     |                                                                     ^ Error: expect(locator).toHaveAttribute(expected) failed
  38 |       "href",
  39 |       "/datenschutz"
  40 |     );
  41 |     await expect(footer.getByRole("link", { name: "AGB" })).toHaveAttribute(
  42 |       "href",
  43 |       "/agb"
  44 |     );
  45 |     await expect(footer.getByRole("link", { name: "Impressum" })).toHaveAttribute(
  46 |       "href",
  47 |       "/impressum"
  48 |     );
  49 |   });
  50 | });
  51 | 
```