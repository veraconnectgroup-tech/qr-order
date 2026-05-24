"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hapticLight } from "@/lib/haptics";

const WAITER_ROLES = new Set(["owner", "manager", "staff", "waiter"]);

export function WaiterLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    hapticLight();

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Pogrešan email ili lozinka.");
      setPending(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Prijava nije uspjela.");
      setPending(false);
      return;
    }

    const { data: staff } = await supabase
      .from("staff")
      .select("role")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    const role = (staff as { role: string } | null)?.role;
    if (!role || !WAITER_ROLES.has(role)) {
      await supabase.auth.signOut();
      setError("Ovaj nalog nema pristup waiter aplikaciji.");
      setPending(false);
      return;
    }

    router.refresh();
    router.push("/waiter");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <Label htmlFor="waiter-email" className="text-dash-text-muted">
          Email
        </Label>
        <Input
          id="waiter-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username email"
          placeholder="ime@restoran.com"
          required
          className="mt-2 min-h-12 border-dash-border-subtle bg-dash-surface text-base text-dash-text"
        />
      </div>
      <div>
        <Label htmlFor="waiter-password" className="text-dash-text-muted">
          Lozinka
        </Label>
        <Input
          id="waiter-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          className="mt-2 min-h-12 border-dash-border-subtle bg-dash-surface text-base text-dash-text"
        />
      </div>
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full bg-dash-accent text-base font-semibold hover:bg-dash-accent/90"
      >
        {pending ? "Prijava…" : "Prijava"}
      </Button>
      <p className="text-center text-sm text-dash-text-muted">
        PIN prijava dolazi uskoro.{" "}
        <Link href="/login" className="text-dash-accent hover:underline">
          Dashboard login
        </Link>
      </p>
    </form>
  );
}
