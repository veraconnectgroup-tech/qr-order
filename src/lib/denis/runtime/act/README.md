# Runtime — Act (M23)

**Track:** M23 ✅  
**ADR:** [ADR-003 §2.3](../../../docs/architecture/ADR-003-denis-platform-v2.md), [ACL §8](../../../docs/architecture/ADR-003-denis-platform-v2.md)

- Planned skills from kernel → `executeActPhase`
- `order.submit` → `acl/executeDenisOrderCommand` when `actSubmitEnabled` + not dry-run
- Default: `actLayerEnabled: false`, `actDryRun: true` — timeline `skill.executed` only

Legacy `execute-chat-turn` still owns guest cart/submit until ops enables Denis act submit.
