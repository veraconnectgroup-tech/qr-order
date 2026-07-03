"use client";

import type { ReactNode } from "react";
import {
  BellRing,
  Check,
  ChefHat,
  Clock3,
  CreditCard,
  Hash,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Send,
  Smile,
  UserCheck,
  Wine,
} from "lucide-react";
import { DenisTableMark } from "@/components/design-system/denis-table-mark";
import { cn } from "@/lib/utils";

type AvatarTone = "neutral" | "denis" | "green" | "blue";
type StationTone = "green" | "blue" | "orange" | "red";

function Avatar({
  name,
  tone = "neutral",
}: {
  name: string;
  tone?: AvatarTone;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  if (tone === "denis") {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#d8dee8] bg-[#f6f7f9] sm:size-11">
        <DenisTableMark size={24} state="think" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md text-[13px] font-semibold sm:size-11",
        tone === "green" && "bg-emerald-100 text-emerald-800",
        tone === "blue" && "bg-sky-100 text-sky-800",
        tone === "neutral" && "bg-[#eef1f5] text-[#596273]"
      )}
    >
      {initials}
    </div>
  );
}

function Reaction({
  icon,
  count,
  tone = "green",
}: {
  icon: ReactNode;
  count: number;
  tone?: "green" | "orange";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium",
        tone === "green" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "orange" &&
          "border-orange-200 bg-orange-50 text-orange-700"
      )}
    >
      {icon}
      {count}
    </span>
  );
}

function ActionChip({
  icon,
  label,
  active,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-8 items-center gap-2 rounded-md border px-3 text-[12px] font-medium transition sm:text-[13px]",
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-[#d8dee8] bg-white text-[#596273] hover:border-[#aeb7c5] hover:text-[#1f2328]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StationPill({
  icon,
  label,
  value,
  tone,
  compact,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: StationTone;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-[#e3e7ee] bg-[#fbfcfd]",
        compact ? "p-2" : "p-2.5"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 font-medium text-[#6b7280]",
          compact ? "text-[11px]" : "text-[12px]"
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center rounded-md",
            compact ? "size-6" : "size-7",
            tone === "green" && "bg-emerald-50 text-emerald-700",
            tone === "blue" && "bg-sky-50 text-sky-700",
            tone === "orange" && "bg-orange-50 text-orange-700",
            tone === "red" && "bg-red-50 text-red-700"
          )}
        >
          {icon}
        </span>
        {label}
      </div>
      <p
        className={cn(
          "font-semibold text-[#1f2328]",
          compact ? "mt-1 text-[12px]" : "mt-1.5 text-[13px]"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Message({
  avatar,
  name,
  time,
  badge,
  children,
  reactions,
  compact,
}: {
  avatar: ReactNode;
  name: string;
  time: string;
  badge?: string;
  children: ReactNode;
  reactions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 px-4 sm:px-5",
        compact ? "py-2" : "py-2.5"
      )}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-[15px] font-bold text-[#1f2328]">{name}</p>
          {badge && (
            <span className="rounded-md bg-[#eef1f5] px-2 py-0.5 text-[11px] font-bold text-[#596273]">
              {badge}
            </span>
          )}
          <span className="text-[13px] font-medium text-[#6b7280]">
            {time}
          </span>
        </div>
        <div className="mt-1 text-[15px] leading-[1.45] tracking-normal text-[#1f2328] sm:text-[16px]">
          {children}
        </div>
        {reactions && (
          <div className="mt-3 flex flex-wrap gap-2">{reactions}</div>
        )}
      </div>
    </div>
  );
}

export function LandingHeroDenisDemo({
  frameless,
  compact,
}: {
  frameless?: boolean;
  /** Hero viewport — fewer messages, no footer stat row */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden bg-white text-[#1f2328]",
        frameless
          ? "rounded-none"
          : "rounded-xl border border-[#dfe5ed] shadow-[0_32px_100px_rgba(31,35,40,0.12)]"
      )}
    >
      <div className={cn("flex h-11 items-center justify-between border-b border-[#e7ebf0] px-4", compact ? "sm:h-11" : "sm:h-12 sm:px-5")}>
        <div className="flex min-w-0 items-center gap-3">
          <Hash className="size-5 shrink-0 text-[#6b7280]" />
          <p className="truncate text-[18px] font-bold text-[#1f2328]">
            live-shift
          </p>
          <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700 sm:inline-flex">
            18 open tables
          </span>
        </div>
        <div className="hidden items-center gap-3 text-[#6b7280] sm:flex">
          <BellRing className="size-5" />
          <Search className="size-5" />
          <MoreVertical className="size-5" />
        </div>
      </div>

      <div
        className={cn(
          "flex overflow-x-auto border-b border-[#e7ebf0] px-4 sm:px-5",
          compact && "px-4"
        )}
      >
        <button
          type="button"
          className={cn(
            "flex shrink-0 items-center gap-2 border-b-2 border-[#1f2328] px-1 font-semibold text-[#1f2328]",
            compact ? "min-h-9 text-[13px]" : "min-h-11 text-[14px] sm:text-[15px]"
          )}
        >
          <MessageCircle className="size-5" />
          Messages
        </button>
        <button
          type="button"
          className={cn(
            "flex shrink-0 items-center gap-2 font-semibold text-[#6b7280]",
            compact ? "ms-5 min-h-9 text-[13px]" : "ms-6 min-h-11 text-[14px] sm:ms-8 sm:text-[15px]"
          )}
        >
          <Check className="size-5" />
          Actions
        </button>
        <button
          type="button"
          className={cn(
            "flex shrink-0 items-center gap-2 font-semibold text-[#6b7280]",
            compact ? "ms-5 min-h-9 text-[13px]" : "ms-6 min-h-11 text-[14px] sm:ms-8 sm:text-[15px]"
          )}
        >
          <Clock3 className="size-5" />
          Timeline
        </button>
      </div>

      <div className={cn("bg-white", compact ? "py-1" : "py-2")}>
        <Message
          compact={compact}
          avatar={<Avatar name="Marko" tone="blue" />}
          name="Marko"
          time="7:41 PM"
        >
          <span className="rounded-md bg-emerald-100 px-1.5 font-semibold text-[#1f2328]">
            @Denis
          </span>{" "}
          what is happening with table 8?
        </Message>

        <Message
          compact={compact}
          avatar={<Avatar name="Denis" tone="denis" />}
          name="Denis"
          badge="App"
          time="7:42 PM"
          reactions={
            compact ? undefined : (
              <>
                <Reaction icon={<Check className="size-4" />} count={1} />
                <Reaction
                  icon={<UserCheck className="size-4" />}
                  count={1}
                  tone="orange"
                />
              </>
            )
          }
        >
          <p>
            Table 8: drinks ready 4 min. Kitchen in prep. Marko — pick up drinks now.
          </p>

          <div className={cn("mt-3 grid gap-2", compact ? "grid-cols-3" : "sm:grid-cols-3 sm:gap-3")}>
            <StationPill
              compact={compact}
              icon={<Wine className="size-4" />}
              label="Bar"
              value="Ready 4 min"
              tone="green"
            />
            <StationPill
              compact={compact}
              icon={<ChefHat className="size-4" />}
              label="Kitchen"
              value="In prep"
              tone="blue"
            />
            <StationPill
              compact={compact}
              icon={<UserCheck className="size-4" />}
              label="Waiter"
              value="Pickup needed"
              tone="orange"
            />
          </div>

          <div className={cn("mt-3 flex flex-wrap gap-2", compact && "mt-2")}>
            <ActionChip
              icon={<UserCheck className="size-4" />}
              label="Notify waiter"
              active
            />
            <ActionChip
              icon={<ChefHat className="size-4" />}
              label="Ask kitchen"
            />
            <ActionChip
              icon={<Clock3 className="size-4" />}
              label="Open timeline"
            />
          </div>
        </Message>

        {!compact && (
          <>
            <Message
              avatar={<Avatar name="Sarah" tone="green" />}
              name="Sarah"
              time="7:43 PM"
              reactions={
                <Reaction icon={<Check className="size-4" />} count={1} />
              }
            >
              Keep the guest updated and alert me if nobody reacts in two minutes.
            </Message>

            <Message
              avatar={<Avatar name="Denis" tone="denis" />}
              name="Denis"
              badge="App"
              time="7:43 PM"
            >
              Done. Handoff logged. Guest hears: &quot;Your drinks are ready. I am
              notifying staff now.&quot;
            </Message>
          </>
        )}
      </div>

      <div className="border-t border-[#e7ebf0] bg-[#fbfcfd] p-3 sm:p-4">
        <div className="rounded-lg border border-[#dfe5ed] bg-white">
          <div
            className={cn(
              "min-h-9 items-center gap-4 border-b border-[#edf1f5] px-4 text-[#6b7280]",
              compact ? "hidden" : "hidden sm:flex"
            )}
          >
            <span className="font-semibold">B</span>
            <span className="italic">I</span>
            <span className="underline">U</span>
            <span className="line-through">S</span>
            <span className="h-5 w-px bg-[#dfe5ed]" />
            <Plus className="size-5" />
            <Smile className="size-5" />
          </div>
          <div className={cn("flex items-center gap-3 px-4", compact ? "min-h-10" : "min-h-12")}>
            <p className={cn("flex-1 text-[#6b7280]", compact ? "text-[14px]" : "text-[15px]")}>
              Message #live-shift
            </p>
            <button
              type="button"
              aria-label="Send message"
              className="flex size-10 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f2f4f7] hover:text-[#1f2328]"
            >
              <Send className="size-5" />
            </button>
          </div>
        </div>

        {!compact && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-[#e7ebf0] bg-white px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-normal text-[#6b7280]">
                Payment
              </p>
              <p className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-[#1f2328]">
                <CreditCard className="size-4 text-[#6b7280]" />
                Stripe ready
              </p>
            </div>
            <div className="rounded-md border border-[#e7ebf0] bg-white px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-normal text-[#6b7280]">
                Timeline
              </p>
              <p className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-[#1f2328]">
                <Clock3 className="size-4 text-[#6b7280]" />
                Every action logged
              </p>
            </div>
            <div className="rounded-md border border-[#e7ebf0] bg-white px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-normal text-[#6b7280]">
                Manager
              </p>
              <p className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-[#1f2328]">
                <BellRing className="size-4 text-[#6b7280]" />
                Escalates in 2 min
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
