import { requireAdmin } from "@/lib/auth/session";
import { IntegrationCredentialsPanel } from "@/components/admin/integration-credentials-panel";

/**
 * ADR-052 §I — SecretsManager admin surface. Values are entered here
 * once and never shown again; only metadata (provider/environment/type/
 * created_at) is ever read back, matching secrets-manager.ts's own
 * "never returns a raw value except from an execution boundary" rule.
 */
export default async function IntegrationCredentialsPage() {
  await requireAdmin();

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-bold">Integracioni kredencijali</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Sandbox i produkcioni kredencijali za integracije koje Denis (ili
        ručno pisan adapter) koristi. Vrednost se šifruje odmah — nikad se ne
        čuva niti prikazuje kao čist tekst nakon čuvanja.
      </p>
      <IntegrationCredentialsPanel />
    </div>
  );
}
