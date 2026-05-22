"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type SetupStep = {
  id: string;
  label: string;
  href: string;
  done: boolean;
};

export function SetupChecklist({
  stripeOnboarded,
  hasTables,
  hasMenuItems,
  canEdit,
}: {
  stripeOnboarded: boolean;
  hasTables: boolean;
  hasMenuItems: boolean;
  canEdit: boolean;
}) {
  if (!canEdit) return null;

  const steps: SetupStep[] = [
    {
      id: "menu",
      label: "Add menu items",
      href: "/dashboard/menu",
      done: hasMenuItems,
    },
    {
      id: "tables",
      label: "Create tables & print QR codes",
      href: "/dashboard/tables",
      done: hasTables,
    },
    {
      id: "stripe",
      label: "Connect Stripe for card payments",
      href: "/dashboard/settings",
      done: stripeOnboarded,
    },
  ];

  const remaining = steps.filter((step) => !step.done);
  if (remaining.length === 0) return null;

  return (
    <section className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:mb-6 sm:p-5">
      <h2 className="text-sm font-semibold text-amber-100">
        Finish setup ({remaining.length} step
        {remaining.length === 1 ? "" : "s"} left)
      </h2>
      <p className="mt-1 text-xs text-amber-200/70">
        Complete these before your first guest order.
      </p>
      <ul className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition",
                step.done
                  ? "text-zinc-500 line-through"
                  : "text-amber-100 hover:bg-amber-500/10"
              )}
            >
              {step.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
              ) : (
                <Circle className="size-4 shrink-0 text-amber-400" />
              )}
              {step.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
