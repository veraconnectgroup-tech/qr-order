"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptStaffInvite } from "@/lib/dashboard/staff-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AcceptInviteForm({ token }: { token: string }) {
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
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <Label htmlFor="password">Choose a password</Label>
        <Input
          id="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 h-10"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">At least 8 characters</p>
      </div>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? "Creating account…" : "Accept invite"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
