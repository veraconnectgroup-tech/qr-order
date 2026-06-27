# Denis compliance layer

Audit trail, GDPR retention, and food-safety logging for Denis turns.

| Module | Role |
|--------|------|
| `audit-trail.ts` | Build hashed audit entries from turn metadata |
| `persist-audit-entry.ts` | Append-only persistence |

Imported by `runtime/` after each guest turn.
