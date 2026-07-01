export type TableTransferRow = {
  order_ids: string[];
  from_table: { name: string } | null;
};

export function parseTableTransferRows(data: unknown): TableTransferRow[] {
  if (!Array.isArray(data)) return [];
  return data as TableTransferRow[];
}

export function buildTransferSourceMap(
  transfers: TableTransferRow[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const transfer of transfers) {
    const tableName = transfer.from_table?.name;
    if (!tableName) continue;
    for (const orderId of transfer.order_ids) {
      map.set(orderId, tableName);
    }
  }
  return map;
}
