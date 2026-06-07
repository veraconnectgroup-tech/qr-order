# ADR-039 — Nudge Outcome Loop (Table OS Learning)

| Field | Value |
|-------|--------|
| **Status** | **APPROVED** — L1 implemented |
| **Parent** | [ADR-038 GMM](./ADR-038-guest-mental-model.md) · [ADR-040 UPDS](./ADR-040-unified-proactive-decision-spine.md) · [ADR-020 §19](./ADR-020-denis-table-operating-system.md) · [ADR-014](./ADR-014-commerce-experience-platform.md) |
| **Rule** | Complete the fold. Feed existing M16. No parallel learning engine. |

---

## 0. One sentence

**Nudge learning is not a new subsystem** — it is the natural output of Denis folding timeline truth into `state.offer.trace`, closing the loop with one terminal event (`anticipation.resolved`), and feeding the existing M16 learned-edges pipeline.

---

## 1. Why v1/v2/v3 were wrong shape

| Approach | Problem |
|----------|---------|
| `denis_nudge_outcomes` table as truth | Duplicates `denis_timeline` + `commerce_experience_events` |
| `state.anticipation` slice | Duplicates `state.offer.trace` |
| Bandit priors in config | New machinery when M16 + VKG weights exist |
| DB reads in rank | Violates ADR-019 FOLD invariant |
| 7 crons | ADR-014 outbox rollup already exists |

---

## 2. Architecture — Truth · Mind · Learn

```
TRUTH                          MIND (pure fold)                 LEARN (offline)
──────                         ────────────────                 ──────────────
proactive.emitted         →    offer.trace.outcomes             M16 cron aggregate
anticipation.resolved          offer.trace.sessionAttachRate  →  learned_edges queue
offer.converted (accept)       mental.nudgeBudget (+ fatigue)    admin approve → VKG
order_items (revenue)          scoreBrowseProducts M16 boost     venue sim gate
```

**Live loop:** FOLD detects outcome → ACT appends `anticipation.resolved` → next FOLD updates budget.

**Offline loop:** cron replays timeline → M16 stats → admin promotes VKG edge / template.

---

## 3. Outcome detection (pure fold)

Module: `src/lib/denis/cognition/offer/fold-nudge-outcomes.ts`

| Outcome | Window | Signal |
|---------|--------|--------|
| `accepted` | 180s | `add_to_cart` for nudge `productId` |
| `declined` | 300s | explicit decline regex or dismiss key |
| `ignored` | 300s | guest message (non-decline) |
| `expired` | 300s | timeout (scheduler/watcher passes `nowMs`) |

Priority: **accepted > declined > ignored > expired**.

`offer.converted` remains for M16 scoring (600s window) — backward compatible.

---

## 4. Timeline event

```typescript
// event_type: "anticipation.resolved"
{
  type: "anticipation.resolved",
  nudgeId, nudgeKind, outcome, signal,
  productId, productName, offerResolution,
  emittedAt, resolvedAt, lagMs
}
```

`nudgeId` = emit `dedupeKey` or `{kind}:{productId}:{emittedAt}`.

---

## 5. Mind integration

### `state.offer.trace` (extended)

- `outcomes: NudgeOutcomeRecord[]`
- `pendingNudges: PendingNudge[]`
- `sessionAttachRate: number`

### Session fatigue → budget

`deriveSessionNudgeFatigue(outcomes)` → `deriveNudgeBudget`:
- `exhausted` → budget 0 (accept→decline→decline pattern)
- `cooling` → max − 1 (low session attach rate)

---

## 6. What feeds learning (L2+ — not in L1)

| Need | Mechanism |
|------|-----------|
| Per-product performance | M16 aggregate on `anticipation.resolved` |
| Per-kind accept rate | Extend `denis-learned-edges` cron |
| Location rank weights | VKG `weight` via admin approve (existing M16) |
| A/B templates | `ConciergePlaybookVariant` A/B + shadow diff |
| Incremental revenue | GMM shadow holdout + M20 venue sim |
| Chain rollup | Extend `rollup-anticipation-analytics.ts` |
| Owner digest | ADR-020 §19 metrics template |

---

## 7. Rollout

```typescript
// No new config block for L1 — outcomes always recorded when Denis runs.
// L2: learning.learnedEdgesEnabled (existing) consumes outcome stats.
```

---

## 8. Implementation phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **L1** | fold + `anticipation.resolved` + fatigue budget + tests | ✅ |
| **L2** | commerce projection + rollup + M16 nudge edges cron | ✅ |
| **L3** | Revenue attribution fold × order_items | ✅ |
| **L4** | Admin insights panel + weekly digest cron | ✅ |

---

## 9. Eval scenarios (L1)

- `nudge_accept_within_180s`
- `nudge_decline_explicit`
- `nudge_decline_dismiss`
- `nudge_ignored_unrelated_message`
- `nudge_expired_timeout`
- `nudge_fatigue_exhausts_budget`

---

## 10. Reference files

| File | Role |
|------|------|
| `offer/fold-nudge-outcomes.ts` | Pure lifecycle fold |
| `offer/append-nudge-outcome.ts` | Timeline persist |
| `mental-model/derive-session-nudge-fatigue.ts` | Budget gate |
| `offer/fold-guest-offer-context.ts` | Trace integration |
| `runtime/run-denis-sense.ts` | ACT hook |
| `runtime/run-session-watcher.ts` | Expired resolve tick |
