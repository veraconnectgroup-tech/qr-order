"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

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
      setError("Invalid email or password.");
      setPending(false);
      return;
    }

    router.refresh();
    router.push("/dashboard/orders");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <Label htmlFor="email" className="text-zinc-400">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@restaurant.com"
          required
          autoComplete="email"
          className="mt-1 border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-orange-500 focus-visible:ring-orange-500/20"
        />
      </div>
      <div>
        <Label htmlFor="password" className="text-zinc-400">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="current-password"
          className="mt-1 border-zinc-800 bg-zinc-900 text-zinc-100 focus-visible:border-orange-500 focus-visible:ring-orange-500/20"
        />
      </div>
      {error && <p className="text-sm text-orange-400">{error}</p>}
      <Button
        type="submit"
        disabled={pending}
        className="w-full bg-orange-500 hover:bg-orange-600"
      >
        {pending ? "Signing in..." : "Sign In"}
      </Button>
      <p className="text-center text-sm text-zinc-500">
        No account?{" "}
        <Link href="/signup" className="font-medium text-orange-500 hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
