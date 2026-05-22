"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return (await loginAction(formData)) ?? null;
    },
    null
  );

  return (
    <form action={action} className="mt-8 space-y-4">
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
          className="mt-1 border-zinc-800 bg-zinc-900 text-zinc-100 focus-visible:border-orange-500 focus-visible:ring-orange-500/20"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-orange-400">{state.error}</p>
      )}
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
