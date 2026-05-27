# ACL — Order Core boundary

**Track:** M23 ✅  
**ADR:** [ADR-003 §8](../../../docs/architecture/ADR-003-denis-platform-v2.md)

- `denis-order-command.schema.ts` — typed command envelope
- `map-command-to-cart.ts` — price snapshot validation → `CartItemInput`
- `execute-denis-order-command.ts` — `createOrderFromCart` + Redis idempotency

Legacy `src/lib/ai/ordering/order-executor.ts` remains allowlisted until `actSubmitEnabled` cutover.
