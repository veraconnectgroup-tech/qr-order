export type OrderFeedbackRow = {
  id: string;
  order_id: string;
  location_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type FeedbackWithOrder = OrderFeedbackRow & {
  order_number: number;
};

export function averageRating(rows: Array<{ rating: number }>): number | null {
  if (!rows.length) return null;
  const sum = rows.reduce((acc, row) => acc + row.rating, 0);
  return Math.round((sum / rows.length) * 10) / 10;
}

export function formatAverageRating(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(1);
}
