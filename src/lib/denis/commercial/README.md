# Commercial — AI metering & billing spine (ADR-009)

**Track:** F3–F5  
**ADR:** [ADR-009](../../../docs/architecture/ADR-009-atomic-turn-commercial-spine.md)

- `metering.ts` — balance check, turn finalize via `finalize_denis_turn_metering` RPC
- `billing-events.ts` — timeline + outbox event shapes
- `low-balance.ts` — threshold + outbox enqueue (F4)
- `resolve-org.ts` — org id from verified guest context

**Rules**

- Only `runDenisTurn` calls turn metering (not `executeChatTurn`).
- Stripe `add_ai_credits` stays in webhook until `billing.credits_purchased` wrapper lands (F7).
