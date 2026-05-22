"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptStaffInvite } from "@/lib/dashboard/staff-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AcceptInviteForm({
  token,
  email,
  name,
  role,
  orgName,
}: {
  token: string;
  email: string;
  name: string;
  role: string;
  orgName: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("token", token);
    fd.set("password", password);

    startTransition(async () => {
      const result = await acceptStaffInvite(fd);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Account created — sign in to continue");
      router.push("/login");
    });
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-sm text-zinc-500">Join team</p>
      <h1 className="mt-1 text-2xl font-bold text-zinc-50">{orgName}</h1>
      <p className="mt-2 text-sm text-zinc-400">
        {name} · {email} · {role}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="password" className="text-zinc-400">
            Choose a password
          </Label>
          <Input
            id="password"
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 border-zinc-700 bg-zinc-950 text-zinc-100"
          />
        </div>
        <Button
          type="submit"
          disabled={pending}
          className="w-full bg-orange-500 hover:bg-orange-600"
        >
          {pending ? "Creating account…" : "Accept invite"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="text-orange-400 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
