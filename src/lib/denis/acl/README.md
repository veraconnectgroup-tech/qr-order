# ACL — Order Core boundary

**Track:** M7 (wired), always enforced  
**ADR:** [ADR-003 §8](../../../docs/architecture/ADR-003-denis-platform-v2.md), [ADR-001](../../../docs/architecture/ADR-001-universal-ordering-platform.md)

- `DenisOrderCommand` → `create-order` / order-executor
- **Only** path from Denis to fiscal/commerce side effects

Legacy allowlist until cutover: `src/lib/ai/ordering/order-executor.ts`
