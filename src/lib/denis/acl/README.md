# ACL — Order Core boundary

**Track:** M23 ✅ · **F8-3** live submit pilot  
**ADR:** [ADR-003 §8](../../../docs/architecture/ADR-003-denis-platform-v2.md)

- `denis-order-command.schema.ts` — typed command envelope
- `map-command-to-cart.ts` — price snapshot validation → `CartItemInput`
- `execute-denis-order-command.ts` — `createOrderFromCart` + Redis idempotency

**Live submit:** `actSubmitEnabled` + `!actDryRun` → `order.submit` skill → ACL (F8-3). Guest API returns `submitOrder: false`.

**Legacy fallback:** `src/lib/ai/ordering/order-executor.ts` via guest `/api/ai/order/submit` until all venues on act submit pilot.
