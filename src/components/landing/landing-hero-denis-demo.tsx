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

/** Soft tinted status colors for the light product window */
const TONE_CLASSES: Record<Tone, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  red: "border-red-200 bg-red-50 text-red-700",
  zinc: "border-zinc-200 bg-zinc-50 text-zinc-600",
};

const SHIFT_METRICS: Record<
  LandingLocale,
  { value: string; label: string }[]
> = {
  en: [
    { value: "3.1 min", label: "Avg pickup" },
    { value: "+18%", label: "Avg check" },
    { value: "12/18", label: "Tables calm" },
  ],
  de: [
    { value: "3,1 min", label: "Ø Abholung" },
    { value: "+18%", label: "Ø Bon" },
    { value: "12/18", label: "Tische ruhig" },
  ],
  sr: [
    { value: "3,1 min", label: "Prosek preuzimanja" },
    { value: "+18%", label: "Prosečan račun" },
    { value: "12/18", label: "Stolovi mirni" },
  ],
};

const TONE_DOT: Record<Tone, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  blue: "bg-sky-500",
  red: "bg-red-500",
  zinc: "bg-zinc-400",
};

function StationRow({ line }: { line: StationLine }) {
  const Icon = line.icon;

  return (
    <div className="flex items-center gap-3 border-t border-zinc-100 px-4 py-3 first:border-t-0">
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-lg border",
          TONE_CLASSES[line.tone]
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
          {line.label}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[14px] font-semibold text-zinc-900">
          <span
            className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[line.tone])}
            aria-hidden
          />
          {line.value}
        </p>
      </div>
      <p className="shrink-0 text-right text-[12px] text-zinc-400">
        {line.detail}
      </p>
    </div>
  );
}

/**
 * Guest phone stays dark on purpose — the guest app ships with the dark
 * luxury theme (ADR-007), and the contrast reads well inside the light window.
 * Colors are explicit because --qr-* tokens are not defined on .landing-page.
 */
function GuestPhone({ step }: { step: ShiftStep }) {
  return (
    <ShowcasePhone hideLabel className="mx-auto max-w-[210px]">
      <ScaledPhonePreview designWidth={240} designHeight={400}>
        <div className="flex min-h-[400px] flex-col bg-[#0a0908] text-[#f5f0eb]">
          <div className="flex items-center gap-2 border-b border-white/[0.08] px-3 py-3">
            <DenisTableMark size={24} state="listen" />
            <span className="text-[11px] font-semibold">Denis</span>
            <span className="ms-auto inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[9px] font-medium text-emerald-300">
              <span className="size-1 rounded-full bg-emerald-400" aria-hidden />
              Live
            </span>
          </div>
          <div className="flex-1 space-y-3 px-3 py-4">
            <div className="ml-4 rounded-xl rounded-br-sm bg-[#211e1b] p-3">
              <p className="text-[9px] font-medium uppercase tracking-wide text-[#9c958c]">
                Guest
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#f5f0eb]">
                {step.guestLine}
              </p>
            </div>
            <div className="mr-4 rounded-xl rounded-bl-sm border border-[#e85d04]/25 bg-[#e85d04]/10 p-3">
              <p className="text-[9px] font-medium uppercase tracking-wide text-[#e88a4d]">
                Denis
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#f5f0eb]">
                {step.answer}
              </p>
            </div>
          </div>
          <div className="border-t border-white/[0.08] px-3 py-3">
            <div className="rounded-full border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[10px] text-[#9c958c]">
              Ask Denis...
            </div>
          </div>
        </div>
      </ScaledPhonePreview>
    </ShowcasePhone>
  );
}

export function LandingHeroDenisDemo({ frameless }: { frameless?: boolean }) {
  const { locale, copy } = useLandingCopy();
  const steps = SHIFT_STEPS[locale] ?? SHIFT_STEPS.en;
  const metrics = SHIFT_METRICS[locale] ?? SHIFT_METRICS.en;
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[Math.min(stepIndex, steps.length - 1)]!;

  const advance = useCallback(() => {
    setStepIndex((current) => (current + 1) % steps.length);
  }, [steps.length]);

  return (
    <div
      className={cn(
        "relative mx-auto w-full",
        frameless ? "max-w-none" : "max-w-[760px]"
      )}
    >
      {!frameless && (
        <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-normal text-zinc-500">
          {copy.hero.demoLabel}
        </p>
      )}

      <div
        className={cn(
          "border border-zinc-200/80 bg-white",
          frameless
            ? "overflow-hidden rounded-lg sm:rounded-xl"
            : "rounded-lg shadow-[0_24px_80px_-24px_rgba(22,20,14,0.25)]"
        )}
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2.5 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
          <div className="flex shrink-0 gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="min-w-0 flex-1 truncate rounded-md bg-white px-2.5 py-0.5 text-center text-[10px] text-zinc-400 ring-1 ring-zinc-200">
            denis.app/dashboard/floor
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-zinc-100 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <DenisTableMark size={24} state="think" />
            <div>
              <p className="text-[13px] font-semibold text-zinc-900">
                Skyline Lounge
              </p>
              <p className="text-[11px] text-zinc-400">
                Live service · Denis watching
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
            18 open
          </span>
        </div>

        <div className="grid gap-px bg-zinc-100 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-zinc-900">
                    {step.table}
                  </h2>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
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
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-right">
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                  Payment
                </p>
                <p className="text-[12px] font-medium text-zinc-700">
                  {step.payment}
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200 bg-white">
              {step.stations.map((line) => (
                <StationRow key={`${line.label}-${line.value}`} line={line} />
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50/70 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--lp-ember,#e85d04)] text-white">
                  <Activity className="size-4" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-orange-600/80">
                    Next best action
                  </p>
                  <p className="mt-1 text-[15px] font-semibold leading-snug text-zinc-900">
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
                  className="min-h-9 rounded-full border border-zinc-200 bg-white px-3.5 text-[12px] font-medium text-zinc-600 transition hover:border-orange-300 hover:bg-orange-50 hover:text-zinc-900"
                >
                  {chip}
                </button>
              ))}
            </div>

            <div className="min-h-4 flex-1" aria-hidden />
            <div className="grid grid-cols-3 divide-x divide-zinc-100 border-t border-zinc-100 pt-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="px-3 first:pl-0 last:pr-0">
                  <p className="text-[16px] font-semibold tracking-[-0.02em] text-zinc-900">
                    {metric.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-px bg-zinc-100 sm:grid-cols-2 lg:grid-cols-1">
            <div className="bg-white p-4 sm:p-5">
              <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-zinc-900">
                  <MessageSquareText
                    className="size-4 text-[var(--lp-ember,#e85d04)]"
                    strokeWidth={1.75}
                  />
                  Staff Ask Denis
                </div>
                <p className="rounded-lg rounded-br-sm border border-zinc-200 bg-white p-3 text-[13px] leading-relaxed text-zinc-600">
                  {step.ask}
                </p>
                <p className="mt-3 rounded-lg rounded-bl-sm border border-emerald-200 bg-emerald-50 p-3 text-[13px] leading-relaxed text-emerald-900">
                  {step.answer}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5">
              <GuestPhone step={step} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
