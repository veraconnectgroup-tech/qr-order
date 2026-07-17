import { requireAdmin } from "@/lib/auth/session";
import { IntegrationBuilderPanel } from "@/components/admin/integration-builder-panel";

/**
 * ADR-052 — first end-to-end wiring of the parse → discover → map →
 * generate pipeline (Phases 0-4 existed as isolated pure functions with
 * no caller connecting them until now). Deliberately does not persist to
 * integration_documents/integration_capabilities yet or write generated
 * code into src/lib/pos/adapters/ — this is the review/draft surface,
 * not the activation path. See analyze-integration-document.ts.
 */
export default async function IntegrationBuilderPage() {
  await requireAdmin();

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-bold">Integration Builder</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Nalepi OpenAPI ili Postman dokumentaciju novog sistema — Denis
        predlaže koje sposobnosti prepoznaje i generiše nacrt adaptera. Ništa
        se ne aktivira automatski; svaki korak čeka tvoje odobrenje.
      </p>
      <IntegrationBuilderPanel />
    </div>
  );
}
