# ACL — Order Core boundary

**Status:** stub (`DENIS_ACL_LAYER` marker only)  
**ADR:** [ADR-003 §8](../../../docs/architecture/ADR-003-denis-platform-v2.md)

**Today:** all order creates go through legacy `src/lib/ai/ordering/order-executor.ts` (compliance allowlist).

**Target:** `DenisOrderCommand` → ACL → Order Core / `create-order` when `runtime/act/` ships.
