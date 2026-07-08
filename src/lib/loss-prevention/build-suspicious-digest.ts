import type { OpenSuspiciousFlag } from "@/lib/loss-prevention/load-open-suspicious-flags";

export type SuspiciousDigestSection = {
  title: string;
  items: string[];
};

export type SuspiciousDigest = {
  totalFlags: number;
  shown: number;
  overflow: number;
  sections: SuspiciousDigestSection[];
  lines: string[];
};

function groupByAction(flags: OpenSuspiciousFlag[]): Map<string, OpenSuspiciousFlag[]> {
  const map = new Map<string, OpenSuspiciousFlag[]>();
  for (const flag of flags) {
    const list = map.get(flag.action) ?? [];
    list.push(flag);
    map.set(flag.action, list);
  }
  return map;
}

const ACTION_LABELS: Record<string, string> = {
  void: "Voidovi",
  transfer: "Transferi",
  split: "Split računa",
  merge: "Merge stolova",
  payment_mismatch: "Plaćanja",
  refund: "Refundovi",
  discount: "Popusti",
  session_close: "Zatvaranje sesija",
};

/** Owner daily digest — max N items, neutral tone — ADR-044 S7. */
export function buildSuspiciousDigest(
  flags: OpenSuspiciousFlag[],
  maxItems = 10
): SuspiciousDigest {
  const limited = flags.slice(0, maxItems);
  const overflow = Math.max(0, flags.length - limited.length);
  const grouped = groupByAction(limited);

  const sections: SuspiciousDigestSection[] = [];
  const lines: string[] = [];

  for (const [action, items] of grouped) {
    const title = ACTION_LABELS[action] ?? action;
    const sectionLines = items.map((item) => {
      const time = new Date(item.createdAt).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const table = item.tableName ? `, ${item.tableName}` : "";
      return `${item.copy} (${time}${table})`;
    });
    sections.push({ title, items: sectionLines });
    lines.push(...sectionLines);
  }

  return {
    totalFlags: flags.length,
    shown: limited.length,
    overflow,
    sections,
    lines,
  };
}
