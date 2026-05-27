"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        <Label htmlFor="restaurantName">Venue name</Label>
        <Input
          id="restaurantName"
          name="restaurantName"
          placeholder="Skyline Lounge"
          required
          autoComplete="organization"
          className="mt-1.5 h-10"
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@restaurant.com"
          required
          autoComplete="email"
          className="mt-1.5 h-10"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1.5 h-10"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">At least 8 characters</p>
      </div>
      {state?.error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-red-300"
        >
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? "Creating account..." : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:text-primary/90 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
