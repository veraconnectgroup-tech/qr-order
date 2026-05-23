export type ScrollContextView = {
  name: string;
  count: number;
  productId?: string;
};

export type ScrollContext = {
  browseMinutes?: number;
  views: ScrollContextView[];
  hasOrdered?: boolean;
  raw?: string;
};

export function parseBrowsingContextToScrollContext(
  raw: string | undefined | null
): ScrollContext | null {
  if (!raw?.trim()) return null;

  const text = raw.trim();
  const minutesMatch = text.match(/(\d+)\s*min/i);
  const views: ScrollContextView[] = [];

  const viewedMatch = text.match(
    /(?:Najgledanije|Most viewed|Meist angesehen|Top views):\s*(.+?)(?:\.|$)/i
  );
  if (viewedMatch?.[1] && viewedMatch[1] !== "—") {
    for (const part of viewedMatch[1].matchAll(/(.+?)\s*\((\d+)x\)/g)) {
      views.push({
        name: part[1].trim(),
        count: Number.parseInt(part[2], 10) || 1,
      });
    }
  }

  const hasOrdered =
    /(?:Već je naručio|Already ordered|Bereits bestellt|ordered)/i.test(text) &&
    !/(?:Nije naručio|Not ordered|Noch nicht bestellt|not ordered)/i.test(text);

  return {
    browseMinutes: minutesMatch
      ? Number.parseInt(minutesMatch[1], 10)
      : undefined,
    views,
    hasOrdered,
    raw: text,
  };
}
