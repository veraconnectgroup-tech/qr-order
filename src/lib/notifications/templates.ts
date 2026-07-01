import type { NotificationTemplateId } from "@/lib/notifications/types";

export type NotificationTemplate = {
  id: NotificationTemplateId;
  kind: "transactional" | "marketing";
  label: string;
  description: string;
  defaultBodySr: string;
};

/** Admin-visible template catalog — copy defaults (Prompt 89). */
export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    id: "waitlist.table_ready",
    kind: "transactional",
    label: "Waitlist — sto spreman",
    description: "Šalje se kad je sto spreman za gosta sa liste čekanja.",
    defaultBodySr:
      "Vaš sto je spreman! Dođite za 5 minuta ili ćemo ga dodeliti drugom gostu.",
  },
  {
    id: "takeaway.order_ready",
    kind: "transactional",
    label: "Takeaway — spremno",
    description: "Narudžbina spremna za preuzimanje.",
    defaultBodySr: "Vaša narudžbina je spremna za preuzimanje!",
  },
  {
    id: "reservation.reminder_2h",
    kind: "transactional",
    label: "Rezervacija — podsjetnik 2h",
    description: "Podsjetnik dva sata pre rezervacije.",
    defaultBodySr: "Podsjetnik: vaša rezervacija je večeras u {time}.",
  },
  {
    id: "engagement.win_back",
    kind: "marketing",
    label: "Re-engagement — win-back",
    description: "30+ dana bez posete, samo uz marketing opt-in.",
    defaultBodySr: "Nedostajete nam! -10% na sledeću posetu",
  },
  {
    id: "engagement.birthday",
    kind: "marketing",
    label: "Rođendan",
    description: "Rođendanska poruka sa desertom.",
    defaultBodySr: "Sretan rođendan! Desert na naš račun 🎂",
  },
  {
    id: "engagement.weekly_special",
    kind: "marketing",
    label: "Novi specijal",
    description: "Personalizovani novi proizvod na meniju.",
    defaultBodySr: "Novi specijal na meniju — mislimo da će vam se svideti.",
  },
  {
    id: "engagement.loyalty_milestone",
    kind: "marketing",
    label: "Loyalty milestone",
    description: "Nagrada za N-tu posetu.",
    defaultBodySr: "Desert na račun kuće — hvala na lojalnosti!",
  },
  {
    id: "engagement.event_invite",
    kind: "marketing",
    label: "Poziv na događaj",
    description: "Poziv na specijalni event u lokalu.",
    defaultBodySr: "Specijalan događaj uskoro — radujemo se vašoj poseti.",
  },
];

export function getNotificationTemplate(
  id: NotificationTemplateId
): NotificationTemplate | undefined {
  return NOTIFICATION_TEMPLATES.find((row) => row.id === id);
}

export function buildWaitlistTableReadySms(input: {
  timeoutMinutes?: number;
  language?: string;
}): string {
  const lang = (input.language ?? "sr").slice(0, 2);
  const minutes = input.timeoutMinutes ?? 5;
  if (lang === "en") {
    return `Your table is ready! Please arrive within ${minutes} minutes or we will assign it to another guest.`;
  }
  return `Vaš sto je spreman! Dođite za ${minutes} minuta ili ćemo ga dodeliti drugom gostu.`;
}

export function buildReservationReminderMessage(input: {
  scheduledAt: string;
  language?: string;
}): string {
  const lang = (input.language ?? "sr").slice(0, 2);
  const date = new Date(input.scheduledAt);
  const time = Number.isFinite(date.getTime())
    ? date.toLocaleTimeString(lang === "en" ? "en-GB" : "sr-RS", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : input.scheduledAt;

  if (lang === "en") {
    return `Reminder: your reservation is tonight at ${time}.`;
  }
  return `Podsjetnik: vaša rezervacija je večeras u ${time}.`;
}

export function buildTakeawayReadySms(language?: string): string {
  const lang = (language ?? "sr").slice(0, 2);
  if (lang === "en") return "Your order is ready for pickup!";
  return "Vaša narudžbina je spremna za preuzimanje!";
}

export function buildWinBackSms(language?: string): string {
  const lang = (language ?? "sr").slice(0, 2);
  if (lang === "en") return "We missed you! -10% off your next visit.";
  return "Nedostajete nam! -10% na sledeću posetu";
}

export function buildBirthdaySms(language?: string): string {
  const lang = (language ?? "sr").slice(0, 2);
  if (lang === "en") return "Happy birthday! Dessert is on us 🎂";
  return "Sretan rođendan! Desert na naš račun 🎂";
}

/** True when reservation is ~2 hours away (±15 min window). */
export function shouldSendReservationReminder(input: {
  scheduledAt: string;
  nowMs?: number;
  leadMinutes?: number;
}): boolean {
  const nowMs = input.nowMs ?? Date.now();
  const leadMs = (input.leadMinutes ?? 120) * 60_000;
  const scheduledMs = Date.parse(input.scheduledAt);
  if (!Number.isFinite(scheduledMs)) return false;
  const delta = scheduledMs - nowMs;
  const windowMs = 15 * 60_000;
  return delta >= leadMs - windowMs && delta <= leadMs + windowMs;
}
