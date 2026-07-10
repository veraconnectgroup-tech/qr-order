import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { resolveConnectorStatuses } from "@/lib/integrations/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { DenisIntegrationsMatrix } from "@/components/admin/denis-integrations-matrix";

/**
 * The honest "what can Denis actually do through integrations" view —
 * ADR-048's Capability Engine matrix (YES/NO, never a silent guess),
 * read from the same registry Denis's own context reads from
 * (see assemble-denis-brain-context.ts).
 */
export default async function DenisIntegrationsPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Standort nicht gefunden.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const statuses = await resolveConnectorStatuses(admin, locationId);

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-bold">Denisove integracije</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Šta Denis stvarno ume kroz povezane sisteme — bez nagađanja. Ako nešto
        piše &quot;NIJE POVEZANO&quot;, Denis to iskreno kaže, ne pretvara se
        da zna.
      </p>
      <DenisIntegrationsMatrix statuses={statuses} />
    </div>
  );
}
