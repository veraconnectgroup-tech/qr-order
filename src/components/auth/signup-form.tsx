"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const inputClassName =
  "mt-1.5 border-white/[0.1] bg-[#09090b] text-zinc-100 placeholder:text-zinc-600 focus-visible:border-white/25 focus-visible:ring-white/10";

export function SignupForm() {
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return (await signupAction(formData)) ?? null;
    },
    null
  );

  return (
    <form action={action} className="mt-8 space-y-4">
      <div>
        <Label htmlFor="restaurantName" className="text-zinc-400">
          Venue name
        </Label>
        <Input
          id="restaurantName"
          name="restaurantName"
          placeholder="Skyline Lounge"
          required
          autoComplete="organization"
          className={inputClassName}
        />
      </div>
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
          className={inputClassName}
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
          minLength={8}
          autoComplete="new-password"
          className={inputClassName}
        />
        <p className="mt-1.5 text-xs text-zinc-500">At least 8 characters</p>
      </div>
      {state?.error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="w-full bg-zinc-100 font-semibold text-zinc-950 hover:bg-white"
      >
        {pending ? "Creating account..." : "Create account"}
      </Button>
      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-zinc-300 hover:text-zinc-100 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
