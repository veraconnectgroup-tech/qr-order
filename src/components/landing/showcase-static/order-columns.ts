export type ShowcaseOrderColumnId =
  | "new"
  | "preparing"
  | "ready"
  | "delivered";

export type ShowcaseOrderColumnDef = {
  id: ShowcaseOrderColumnId;
  label: string;
  border: string;
  badge: string;
  statuses: string[];
};

export const SHOWCASE_ORDER_COLUMNS: ShowcaseOrderColumnDef[] = [
  {
    id: "new",
    label: "Queued",
    border: "border-t-[#e85d04]",
    badge: "bg-orange-50 text-orange-700",
    statuses: ["pending"],
  },
  {
    id: "preparing",
    label: "In prep",
    border: "border-t-sky-500",
    badge: "bg-sky-50 text-sky-700",
    statuses: ["preparing", "accepted"],
  },
  {
    id: "ready",
    label: "Ready pickup",
    border: "border-t-emerald-500",
    badge: "bg-emerald-50 text-emerald-700",
    statuses: ["ready"],
  },
  {
    id: "delivered",
    label: "Delivered",
    border: "border-t-[#cfd6df]",
    badge: "bg-[#eef1f5] text-[#596273]",
    statuses: ["delivered"],
  },
];

export function getShowcaseOrderColumnId(
  status: string
): ShowcaseOrderColumnId {
  if (status === "pending") return "new";
  if (status === "preparing" || status === "accepted") return "preparing";
  if (status === "ready") return "ready";
  return "delivered";
}
