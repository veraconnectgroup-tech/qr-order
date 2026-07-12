# Live testing TODO — blocked on Supabase billing

Supabase access is down (subscription unpaid — see the realtime-connection-quota
incident earlier this session). Everything below is verified at the `tsc`
+ `vitest` level (mocked/unit) but has **not** been exercised against a real
database, real auth, or a real Deliverect sandbox. Test each item once
Supabase billing is restored, in roughly this order.

## Admin UI

- [ ] `pos-integrations-panel.tsx` — new "Zugrunde liegendes Kassensystem"
      select (Toast/Lightspeed/orderbird/Unbekannt). Confirm: only shows
      for provider=deliverect, saves `config.pos_vendor` correctly, shows
      the saved value on the connected-integrations list, doesn't break
      existing connect/disconnect/delete flows.

## Denis brain context

- [ ] `loadCapabilityAwarenessBlock` actually reaches the prompt for a
      location with a real connected Deliverect + recorded `pos_vendor` —
      confirm the "POS CAPABILITIES" block appears in owner-voice,
      station-voice fallback, and menu-agent context (via
      `assembleDenisBrainContext`).
- [ ] Confirm Denis actually behaves honestly when asked for something on
      the CANNOT list (e.g. "can I pay at the end after ordering with
      staff?") — say so plainly, don't imply he'll handle it.

## Guest formality override

- [ ] Real guest chat session: say "ne moraš da mi persiraš" mid-
      conversation, confirm Denis switches to "ti" for the rest of that
      session only, confirm a NEW table session defaults back to "vi".
- [ ] Confirm the "dose of respect" instruction actually holds up in a
      real reply (no accidental rudeness once informal).

## Guest Conduct Policy Engine (shadow mode)

- [ ] Send a genuinely rude/insulting message in a real guest session,
      confirm a `conduct.policy_decision` timeline event is written
      (check `denis_timeline` for the session) and that the guest-visible
      reply is completely unaffected (shadow-only, per design).
- [ ] Confirm three escalating offenses in one session step the tier
      none → warn_1 → warn_2 → handoff in the logged events (still
      shadow — never shown to the guest yet).
- [ ] Confirm ordinary service complaints ("hrana kasni") do NOT trigger
      the ladder at all — only rudeness directed at Denis should.

## Realtime connection leak fixes

- [ ] Once Supabase billing is restored, watch the **Realtime Concurrent
      Peak Connections** metric in the Supabase dashboard over a few days
      of real traffic — confirm it stays near actual concurrent guest
      count, not the 3,761/200 spike from before the fix.
- [ ] Deliberately flap a guest's network connection (e.g. airplane mode
      toggle) while an order-tracking or Denis-view SSE stream is open —
      confirm reconnects back off (not every 1s) and old channels
      actually close server-side.

## Denis personality (owner-voice / station-voice)

- [ ] Real owner-voice call: tell Denis about a big sales day, confirm he
      reacts warmly/naturally (not generic), confirm "vi" stays by
      default and switches only if asked, confirm respect holds on "ti".
- [ ] Real station-voice call: confirm Denis proactively mentions
      something relevant the colleague didn't ask about, when genuinely
      relevant (not forced every call).

## Deliverect prepaid flow (Scenario A) — needs a live/sandbox Deliverect account

- [ ] Set `posPushOnPayment: true` for a real (or Deliverect sandbox)
      location, place a QR order, confirm the create-time POS push is
      HELD (nothing sent to Deliverect yet).
- [ ] Complete Stripe payment, confirm `order-saga.ts` pushes to
      Deliverect exactly once, with `orderIsAlreadyPaid: true`.
- [ ] Confirm the Deliverect adapter sends `orderType: 3` and the real
      table name/ID (check what actually appears in the Deliverect/POS
      dashboard, since real table routing is POS-dependent per the
      feasibility report — this is exactly what needs a real sandbox to
      settle, not something guessable from docs).
- [ ] Confirm a `posPushOnPayment: false` (default) location's behavior
      is completely unchanged from before this session's changes.

## Deliverect partnership

- [ ] Submit the questions via https://www.deliverect.com/en/become-a-partner
      (the form, not email — see docs/partnerships/deliverect-partnership-questions.md).
- [ ] Once Deliverect responds, update `pos-capability-matrix.ts`'s
      confidence labels from their real answers — don't leave researched
      guesses in place once real confirmation exists.
