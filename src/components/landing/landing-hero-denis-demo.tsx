"use client";

import { useCallback, useState } from "react";
import {
  Activity,
  BellRing,
  ChefHat,
  CreditCard,
  MessageSquareText,
  UserCheck,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { DenisTableMark } from "@/components/design-system/denis-table-mark";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { ScaledPhonePreview } from "@/components/landing/scaled-phone-preview";
import { ShowcasePhone } from "@/components/landing/showcase-frame";
import type { LandingLocale } from "@/lib/landing/landing-copy";
import { cn } from "@/lib/utils";

type Tone = "green" | "amber" | "blue" | "red" | "zinc";

type StationLine = {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: Tone;
};

type ShiftStep = {
  table: string;
  risk: string;
  tableDetail: string;
  guestLine: string;
  ask: string;
  answer: string;
  nextAction: string;
  payment: string;
  stations: StationLine[];
  chips: string[];
};

const SHIFT_STEPS: Record<LandingLocale, ShiftStep[]> = {
  en: [
    {
      table: "Table 8",
      risk: "Warm",
      tableDetail: "2 guests · QR order · 21 min seated",
      guestLine: "Guest asked: Where are the drinks?",
      ask: "Denis, what is happening with table 8?",
      answer:
        "Bar is ready for 4 min. Kitchen is still in prep. Next action: waiter pickup.",
      nextAction: "Marko, pick up drinks before this becomes a guest risk.",
      payment: "No payment request yet",
      stations: [
        {
          icon: Wine,
          label: "Bar",
          value: "Ready",
          detail: "4 min waiting",
          tone: "green",
        },
        {
          icon: ChefHat,
          label: "Kitchen",
          value: "In prep",
          detail: "14 min active",
          tone: "blue",
        },
        {
          icon: UserCheck,
          label: "Waiter",
          value: "Pickup needed",
          detail: "owner: Marko",
          tone: "amber",
        },
      ],
      chips: ["Ask kitchen", "Notify waiter", "Open timeline"],
    },
    {
      table: "Table 12",
      risk: "High risk",
      tableDetail: "4 guests · second question · food delay",
      guestLine: "Guest asked twice about food.",
      ask: "Should I tell the guest it is coming soon?",
      answer:
        "Not yet. Kitchen has no update for 9 min. Ask station first, then tell only confirmed truth.",
      nextAction: "Kitchen update needed. Escalate manager if no answer in 2 min.",
      payment: "Service recovery before upsell",
      stations: [
        {
          icon: Wine,
          label: "Bar",
          value: "Served",
          detail: "complete",
          tone: "green",
        },
        {
          icon: ChefHat,
          label: "Kitchen",
          value: "No update",
          detail: "9 min silent",
          tone: "red",
        },
        {
          icon: BellRing,
          label: "Manager",
          value: "Stand by",
          detail: "risk rising",
          tone: "amber",
        },
      ],
      chips: ["Ask kitchen", "Escalate", "Pause upsell"],
    },
    {
      table: "Table 5",
      risk: "Ready to close",
      tableDetail: "2 guests · dessert finished · wants bill",
      guestLine: "Guest said: We would like to pay.",
      ask: "Which payment action is next?",
      answer:
        "Payment requested. Stripe checkout is open. Keep table open until payment succeeds.",
      nextAction: "Watch payment. Alert waiter if checkout waits longer than 3 min.",
      payment: "Stripe pending · split available",
      stations: [
        {
          icon: Wine,
          label: "Bar",
          value: "Complete",
          detail: "served",
          tone: "green",
        },
        {
          icon: ChefHat,
          label: "Kitchen",
          value: "Complete",
          detail: "served",
          tone: "green",
        },
        {
          icon: CreditCard,
          label: "Payment",
          value: "Pending",
          detail: "Stripe link open",
          tone: "amber",
        },
      ],
      chips: ["Watch payment", "Call waiter", "Close table"],
    },
  ],
  de: [
    {
      table: "Tisch 8",
      risk: "Warm",
      tableDetail: "2 Gäste · QR Order · 21 min am Tisch",
      guestLine: "Gast fragt: Wo sind die Getränke?",
      ask: "Denis, was ist mit Tisch 8?",
      answer:
        "Bar ist seit 4 min fertig. Küche läuft noch. Nächste Aktion: Service abholen.",
      nextAction: "Marko, Getränke abholen, bevor der Tisch riskant wird.",
      payment: "Noch keine Zahlungsanfrage",
      stations: [
        { icon: Wine, label: "Bar", value: "Fertig", detail: "4 min wartet", tone: "green" },
        { icon: ChefHat, label: "Küche", value: "In prep", detail: "14 min aktiv", tone: "blue" },
        { icon: UserCheck, label: "Service", value: "Abholen", detail: "Owner: Marko", tone: "amber" },
      ],
      chips: ["Küche fragen", "Service melden", "Timeline"],
    },
    {
      table: "Tisch 12",
      risk: "Hohes Risiko",
      tableDetail: "4 Gäste · zweite Frage · Food Delay",
      guestLine: "Gast hat zweimal nach Essen gefragt.",
      ask: "Soll ich sagen, dass es gleich kommt?",
      answer:
        "Noch nicht. Küche hat seit 9 min kein Update. Erst Station fragen, dann bestätigte Wahrheit sagen.",
      nextAction: "Küchen-Update nötig. Manager nach 2 min ohne Antwort.",
      payment: "Service Recovery vor Upsell",
      stations: [
        { icon: Wine, label: "Bar", value: "Serviert", detail: "fertig", tone: "green" },
        { icon: ChefHat, label: "Küche", value: "Kein Update", detail: "9 min still", tone: "red" },
        { icon: BellRing, label: "Manager", value: "Bereit", detail: "Risiko steigt", tone: "amber" },
      ],
      chips: ["Küche fragen", "Eskalieren", "Upsell pausieren"],
    },
    {
      table: "Tisch 5",
      risk: "Zum Abschluss",
      tableDetail: "2 Gäste · Dessert fertig · Rechnung",
      guestLine: "Gast sagt: Wir möchten zahlen.",
      ask: "Welche Zahlungsaktion ist jetzt dran?",
      answer:
        "Zahlung angefragt. Stripe Checkout ist offen. Tisch bleibt offen bis Payment erfolgreich ist.",
      nextAction: "Payment beobachten. Service alarmieren, wenn Checkout länger als 3 min wartet.",
      payment: "Stripe pending · Split möglich",
      stations: [
        { icon: Wine, label: "Bar", value: "Fertig", detail: "serviert", tone: "green" },
        { icon: ChefHat, label: "Küche", value: "Fertig", detail: "serviert", tone: "green" },
        { icon: CreditCard, label: "Payment", value: "Pending", detail: "Stripe Link offen", tone: "amber" },
      ],
      chips: ["Payment watch", "Service rufen", "Tisch schließen"],
    },
  ],
  sr: [
    {
      table: "Sto 8",
      risk: "Topao",
      tableDetail: "2 gosta · QR narudžbina · 21 min za stolom",
      guestLine: "Gost pita: Gde su pića?",
      ask: "Denise, šta je sa stolom 8?",
      answer:
        "Bar je spreman 4 min. Kuhinja je još u pripremi. Sledeća akcija: konobar preuzima piće.",
      nextAction: "Marko, preuzmi piće pre nego što sto uđe u rizik.",
      payment: "Još nema zahteva za plaćanje",
      stations: [
        { icon: Wine, label: "Bar", value: "Spremno", detail: "čeka 4 min", tone: "green" },
        { icon: ChefHat, label: "Kuhinja", value: "U pripremi", detail: "14 min aktivno", tone: "blue" },
        { icon: UserCheck, label: "Konobar", value: "Preuzmi", detail: "owner: Marko", tone: "amber" },
      ],
      chips: ["Pitaj kuhinju", "Javi konobaru", "Timeline"],
    },
    {
      table: "Sto 12",
      risk: "Visok rizik",
      tableDetail: "4 gosta · drugo pitanje · hrana kasni",
      guestLine: "Gost je dva puta pitao za hranu.",
      ask: "Da li da kažem da stiže uskoro?",
      answer:
        "Ne još. Kuhinja nema update 9 min. Prvo pitaj stanicu, zatim reci samo potvrđenu istinu.",
      nextAction: "Treba update kuhinje. Ako nema odgovora 2 min, menadžer.",
      payment: "Service recovery pre upsell-a",
      stations: [
        { icon: Wine, label: "Bar", value: "Posluženo", detail: "gotovo", tone: "green" },
        { icon: ChefHat, label: "Kuhinja", value: "Nema update", detail: "9 min tišina", tone: "red" },
        { icon: BellRing, label: "Menadžer", value: "Spreman", detail: "rizik raste", tone: "amber" },
      ],
      chips: ["Pitaj kuhinju", "Eskaliraj", "Pauziraj upsell"],
    },
    {
      table: "Sto 5",
      risk: "Za zatvaranje",
      tableDetail: "2 gosta · desert završen · žele račun",
      guestLine: "Gost kaže: Želimo da platimo.",
      ask: "Koja je sledeća payment akcija?",
      answer:
        "Plaćanje je zatraženo. Stripe checkout je otvoren. Sto ostaje otvoren dok payment ne uspe.",
      nextAction: "Prati payment. Ako checkout čeka preko 3 min, javi konobaru.",
      payment: "Stripe pending · split dostupan",
      stations: [
        { icon: Wine, label: "Bar", value: "Gotovo", detail: "posluženo", tone: "green" },
        { icon: ChefHat, label: "Kuhinja", value: "Gotovo", detail: "posluženo", tone: "green" },
        { icon: CreditCard, label: "Payment", value: "Pending", detail: "Stripe link otvoren", tone: "amber" },
      ],
      chips: ["Prati payment", "Zovi konobara", "Zatvori sto"],
    },
  ],
};

const TONE_CLASSES: Record<Tone, string> = {
  green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  blue: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  red: "border-red-400/30 bg-red-400/10 text-red-200",
  zinc: "border-white/[0.1] bg-white/[0.04] text-zinc-300",
};

function StationRow({ line }: { line: StationLine }) {
  const Icon = line.icon;

  return (
    <div className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-3 first:border-t-0">
      <div className={cn("flex size-9 items-center justify-center rounded-md border", TONE_CLASSES[line.tone])}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-zinc-500">{line.label}</p>
        <p className="truncate text-[14px] font-semibold text-white">
          {line.value}
        </p>
      </div>
      <p className="shrink-0 text-right text-[12px] text-zinc-500">
        {line.detail}
      </p>
    </div>
  );
}

function GuestPhone({ step }: { step: ShiftStep }) {
  return (
    <ShowcasePhone hideLabel className="mx-auto max-w-[210px] shadow-2xl shadow-black/50">
      <ScaledPhonePreview designWidth={240} designHeight={420}>
        <div className="flex min-h-[420px] flex-col bg-[var(--qr-void)] text-[var(--qr-ivory)]">
          <div className="flex items-center gap-2 border-b border-[var(--qr-elevated)] px-3 py-3">
            <DenisTableMark size={24} state="listen" />
            <span className="text-[11px] font-semibold">Denis</span>
            <span className="ms-auto rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[9px] text-emerald-200">
              Live
            </span>
          </div>
          <div className="flex-1 space-y-3 px-3 py-4">
            <div className="rounded-lg border border-[var(--qr-elevated)] bg-[var(--qr-surface)] p-3">
              <p className="text-[10px] text-[var(--qr-muted)]">Guest</p>
              <p className="mt-1 text-[12px] leading-relaxed">
                {step.guestLine}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--qr-ember)]/30 bg-[var(--qr-ember-muted)] p-3">
              <p className="text-[10px] text-[var(--qr-muted)]">Denis</p>
              <p className="mt-1 text-[12px] leading-relaxed">
                {step.answer}
              </p>
            </div>
          </div>
          <div className="border-t border-[var(--qr-elevated)] px-3 py-3">
            <div className="rounded-md border border-[var(--qr-elevated)] px-3 py-2 text-[10px] text-[var(--qr-muted)]">
              Ask Denis...
            </div>
          </div>
        </div>
      </ScaledPhonePreview>
    </ShowcasePhone>
  );
}

export function LandingHeroDenisDemo() {
  const { locale, copy } = useLandingCopy();
  const steps = SHIFT_STEPS[locale] ?? SHIFT_STEPS.en;
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[Math.min(stepIndex, steps.length - 1)]!;

  const advance = useCallback(() => {
    setStepIndex((current) => (current + 1) % steps.length);
  }, [steps.length]);

  return (
    <div className="relative mx-auto w-full max-w-[760px]">
      <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-normal text-zinc-500">
        {copy.hero.demoLabel}
      </p>

      <div className="rounded-lg border border-white/[0.08] bg-[#0d0c0b] shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-4 py-3">
          <div className="flex items-center gap-3">
            <DenisTableMark size={24} state="think" />
            <div>
              <p className="text-[13px] font-semibold text-white">
                Skyline Lounge
              </p>
              <p className="text-[11px] text-zinc-500">
                Live service · Denis watching
              </p>
            </div>
          </div>
          <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
            18 open
          </span>
        </div>

        <div className="grid gap-px bg-white/[0.06] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="bg-[#0d0c0b] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold text-white">
                    {step.table}
                  </h2>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px] font-medium",
                      step.risk.toLowerCase().includes("high") ||
                        step.risk.toLowerCase().includes("visok") ||
                        step.risk.toLowerCase().includes("hoch")
                        ? TONE_CLASSES.red
                        : TONE_CLASSES.amber
                    )}
                  >
                    {step.risk}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-zinc-500">
                  {step.tableDetail}
                </p>
              </div>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-right">
                <p className="text-[11px] text-zinc-500">Payment</p>
                <p className="text-[12px] font-medium text-zinc-200">
                  {step.payment}
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-white/[0.08] bg-black/20">
              {step.stations.map((line) => (
                <StationRow key={`${line.label}-${line.value}`} line={line} />
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-[var(--qr-ember)]/25 bg-[var(--qr-ember-muted)] p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--qr-ember)] text-white">
                  <Activity className="size-4" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-normal text-zinc-500">
                    Next best action
                  </p>
                  <p className="mt-1 text-[15px] font-semibold leading-snug text-white">
                    {step.nextAction}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {step.chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={advance}
                  className="min-h-9 rounded-md border border-white/[0.1] bg-white/[0.03] px-3 text-[12px] font-medium text-zinc-300 transition hover:border-[var(--qr-ember)]/50 hover:bg-[var(--qr-ember-muted)] hover:text-white"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-1">
            <div className="bg-[#0d0c0b] p-4 sm:p-5">
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-white">
                  <MessageSquareText className="size-4 text-[var(--qr-ember)]" />
                  Staff Ask Denis
                </div>
                <p className="rounded-md border border-white/[0.08] bg-black/25 p-3 text-[13px] leading-relaxed text-zinc-300">
                  {step.ask}
                </p>
                <p className="mt-3 rounded-md border border-emerald-400/20 bg-emerald-400/10 p-3 text-[13px] leading-relaxed text-emerald-100">
                  {step.answer}
                </p>
              </div>
            </div>

            <div className="bg-[#0d0c0b] p-4 sm:p-5">
              <GuestPhone step={step} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
