import Link from "next/link";
import { redirect } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";
import { WaiterLoginForm } from "@/components/waiter/waiter-login-form";
import { getCurrentStaff } from "@/lib/auth/session";

export default async function WaiterLoginPage() {
  const staff = await getCurrentStaff();
  if (staff) {
    redirect("/waiter");
  }

  return (
    <div className="dashboard-theme flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-dash-border-subtle px-4 py-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-dash-accent/15">
            <UtensilsCrossed className="size-5 text-dash-accent" />
          </div>
          <span className="text-sm font-semibold text-dash-text">Vera Waiter</span>
        </Link>
      </header>

      <div className="flex flex-1 flex-col justify-center px-4 py-8 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-2xl font-bold tracking-tight text-dash-text">
            Prijava konobara
          </h1>
          <p className="mt-2 text-sm text-dash-text-muted">
            Email i lozinka vašeg staff naloga
          </p>
          <WaiterLoginForm />
        </div>
      </div>
    </div>
  );
}
