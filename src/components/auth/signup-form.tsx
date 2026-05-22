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
        <Label htmlFor="restaurantName">Naziv restorana</Label>
        <Input
          id="restaurantName"
          name="restaurantName"
          placeholder="Skyline Lounge"
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="vi@lokal.com"
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="password">Lozinka</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Kreiranje naloga..." : "Kreiraj nalog"}
      </Button>
      <p className="text-center text-sm text-neutral-600">
        Već imaš nalog?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          Prijavi se
        </Link>
      </p>
    </form>
  );
}
