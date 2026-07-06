export type BarColumnId = "new" | "making" | "ready";

/** Light pro surface tokens — aligned with landing showcase / live-shift mockups. */
export const BAR_PRO = {
  bg: "bg-[#fbfcfd]",
  surface: "bg-white",
  border: "border-[#e3e7ee]",
  borderSubtle: "border-[#e7ebf0]",
  text: "text-[#1f2328]",
  textSecondary: "text-[#596273]",
  textMuted: "text-[#6b7280]",
  chipBg: "bg-[#eef1f5]",
} as const;

export const BAR_COLUMN_THEME: Record<
  BarColumnId,
  {
    accent: string;
    accentBorder: string;
    statusBadge: string;
    columnPanel: string;
    columnTitle: string;
    countBadge: string;
    primaryBtn: string;
    ghostBtn: string;
  }
> = {
  new: {
    accent: "border-l-[#e85d04]",
    accentBorder: "border-l-2 border-l-[#e85d04]",
    statusBadge: "bg-orange-50 text-orange-800 ring-1 ring-orange-100",
    columnPanel: "border-[#e3e7ee] bg-white",
    columnTitle: "text-[#1f2328]",
    countBadge: "bg-orange-50 text-orange-800 ring-1 ring-orange-100",
    primaryBtn:
      "border border-[#1f2328] bg-[#1f2328] text-white hover:bg-[#2b3038]",
    ghostBtn:
      "border border-[#d8dee8] bg-white text-[#596273] hover:border-[#aeb7c5] hover:text-[#1f2328]",
  },
  making: {
    accent: "border-l-sky-500",
    accentBorder: "border-l-2 border-l-sky-500",
    statusBadge: "bg-sky-50 text-sky-800 ring-1 ring-sky-100",
    columnPanel: "border-[#e3e7ee] bg-white",
    columnTitle: "text-[#1f2328]",
    countBadge: "bg-sky-50 text-sky-800 ring-1 ring-sky-100",
    primaryBtn:
      "border border-sky-700 bg-sky-700 text-white hover:bg-sky-800",
    ghostBtn:
      "border border-[#d8dee8] bg-white text-[#596273] hover:border-[#aeb7c5] hover:text-[#1f2328]",
  },
  ready: {
    accent: "border-l-emerald-500",
    accentBorder: "border-l-2 border-l-emerald-500",
    statusBadge: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100",
    columnPanel: "border-[#e3e7ee] bg-white",
    columnTitle: "text-[#1f2328]",
    countBadge: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100",
    primaryBtn:
      "border border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800",
    ghostBtn:
      "border border-[#d8dee8] bg-white text-[#596273] hover:border-[#aeb7c5] hover:text-[#1f2328]",
  },
};

export function barColumnStatusLabel(columnId: BarColumnId): string {
  switch (columnId) {
    case "new":
      return "Queued";
    case "making":
      return "In prep";
    case "ready":
      return "Ready";
  }
}
