# Email draft — Deliverect Partnership / Developer Team

**To:** Deliverect Partnerships (partnerships@deliverect.com — verify current contact before sending)
**Subject:** Partnership & API questions — digital ordering platform evaluating Deliverect integration

---

Hi,

My name is [NAME], founder of Vera Group. We're evaluating Deliverect as the POS integration layer for a digital ordering platform we're building for restaurants, starting with a prepaid, dine-in QR ordering flow. We're early in technical due diligence and want to confirm what's actually possible on your platform before committing further engineering time — happy to share full product details and roadmap once we're speaking under NDA, but for now we'd just like accurate answers to the questions below.

**One piece of context that matters for a few of these:** guests would pay entirely online (via our own Stripe integration) before we ever create an order in your system — we'd send the order to Deliverect only after payment is confirmed, flagged as already paid. We would not be using Deliverect Pay; we'd bring our own payment processor.

## Partnership model

1. As a partner, can we use your POS integrations across multiple restaurants without each one needing to open its own separate Deliverect account?
2. If a restaurant does need its own Deliverect account, what does that onboarding flow look like, and who is responsible for it?
3. Is a white-labeled experience possible (restaurant and guest never see the Deliverect brand)?
4. How is partner usage priced — per restaurant, per location, per integration, per order, or a revenue share?
5. Can we choose which POS integrations to activate, or is that all-or-nothing per account?

## Dine-in / table order capabilities — specific to Toast, Lightspeed (K-Series and L-Series), and orderbird

6. Does your adapter for each of these three POS systems support reading an already-open bill/check that a waiter has started on a table?
7. Does your adapter for each support appending new items to that already-open bill, or does every order we send always create a new, separate order?
8. Does your adapter for each support marking that existing (non-Deliverect-originated) bill as paid after the fact — an external tender applied to a bill we didn't create — and does the POS then automatically close it?
9. Can we create a custom payment method (e.g. a distinct online-payment label) visible in POS reporting for these three systems, similar to what exists for PAR Brink and Aldelo?
10. Does orderbird have a dedicated integration overview or capability documentation? We noticed your help center has detailed articles for Toast and each Lightspeed series but nothing equivalent for orderbird.

## Table / floor data

11. Is there any API for floor-plan data — table coordinates, shape, or live occupied/free status — beyond the basic table list and seat count returned by `GET /tables/{locationId}`?

## Payments, refunds, tips

12. Do you support split bills or partial payments on any integration?
13. For orders paid through our own payment processor (not Deliverect Pay), do refunds flow through your system at all, or exclusively through our own processor directly?
14. Does the `tip`/`driverTip` field reliably reach POS reporting for Toast, Lightspeed, and orderbird specifically, or is it silently dropped where a POS doesn't support it?

## Development & certification

15. Are POS-specific sandbox environments available for Toast, Lightspeed, and orderbird for development, beyond the generic "Dummy POS"?
16. What does the certification process look like in practice, and does it differ meaningfully between these three POS systems?
17. Is there a webhook for bill-level status changes from the POS (e.g. a waiter closing a bill), separate from the order-status webhook?
18. How exactly does the 48-hour `channelOrderId` uniqueness window work — what happens if we need to reference an order older than that?
19. Are there any constraints or requirements around using an external payment processor instead of Deliverect Pay, for any of these three POS systems specifically?
20. Is there an internal, non-public capability matrix across your POS integrations (even under NDA) that would save us testing each capability blind, POS by POS?

Happy to sign an NDA and go deeper on our product and roadmap on a call — for now just trying to get grounded on what's technically possible. Looking forward to hearing from you.

Best,
[NAME]
Vera Group
