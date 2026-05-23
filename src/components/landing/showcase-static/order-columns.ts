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
    label: "New",
    border: "border-t-orange-500",
    badge: "bg-orange-500 text-white",
    statuses: ["pending"],
  },
  {
    id: "preparing",
    label: "Preparing",
    border: "border-t-yellow-500",
    badge: "bg-yellow-500 text-zinc-950",
    statuses: ["preparing", "accepted"],
  },
  {
    id: "ready",
    label: "Ready",
    border: "border-t-green-500",
    badge: "bg-green-500 text-white",
    statuses: ["ready"],
  },
  {
    id: "delivered",
    label: "Delivered",
    border: "border-t-zinc-600",
    badge: "bg-zinc-700 text-zinc-300",
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
