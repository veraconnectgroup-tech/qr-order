import { runDeepHealthChecks } from "@/lib/health/checks";

export const dynamic = "force-dynamic";

type ServiceStatus = "operational" | "degraded" | "down";

function mapStatus(ok: boolean, degraded?: boolean): ServiceStatus {
  if (ok) return "operational";
  if (degraded) return "degraded";
  return "down";
}

export default async function StatusPage() {
  let health: Awaited<ReturnType<typeof runDeepHealthChecks>> | null = null;
  try {
    health = await runDeepHealthChecks();
  } catch {
    health = null;
  }

  const chatOk = health?.checks.openai?.ok !== false;
  const menuOk = health?.checks.database?.ok !== false;
  const orderOk = health?.checks.database?.ok !== false;
  const paymentOk = health?.checks.stripe?.ok !== false;
  const allOk = chatOk && menuOk && orderOk && paymentOk;

  const services: Array<{ name: string; status: ServiceStatus }> = [
    { name: "Chat Service", status: mapStatus(chatOk, health?.checks.openai?.ok === false) },
    { name: "Menu Service", status: mapStatus(menuOk) },
    { name: "Order Service", status: mapStatus(orderOk) },
    { name: "Payment Service", status: mapStatus(paymentOk, health?.checks.stripe?.ok === false) },
  ];

  return (
    <main className="guest-theme min-h-dvh bg-[var(--qr-void)] px-4 py-12 text-[var(--qr-ivory)]">
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--qr-elevated)] bg-[var(--qr-surface)] p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Denis Status</h1>
          <span className={allOk ? "text-emerald-400" : "text-amber-400"}>
            {allOk ? "🟢 Online" : "🟡 Degraded"}
          </span>
        </div>
        <ul className="space-y-3 border-t border-[var(--qr-elevated)] pt-4">
          {services.map((service) => (
            <li key={service.name} className="flex items-center justify-between text-sm">
              <span>{service.name}</span>
              <span className="text-[var(--qr-muted)]">
                {service.status === "operational"
                  ? "🟢 Operational"
                  : service.status === "degraded"
                    ? "🟡 Degraded"
                    : "🔴 Down"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 border-t border-[var(--qr-elevated)] pt-4 text-xs text-[var(--qr-muted)]">
          Public status page — refreshed on each visit. If issues persist, staff can order from the
          menu while Denis recovers.
        </p>
      </div>
    </main>
  );
}
