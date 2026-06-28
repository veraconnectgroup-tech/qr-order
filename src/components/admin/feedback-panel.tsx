"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import {
  averageRating,
  formatAverageRating,
  type FeedbackWithOrder,
} from "@/lib/feedback/feedback";
import {
  analyzeFeedbackTrends,
  formatFeedbackDigestLines,
} from "@/lib/denis/platform/feedback-intelligence";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "all", label: "All time" },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

function StarRating({
  rating,
  size = "sm",
}: {
  rating: number;
  size?: "sm" | "lg";
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={cn(
            size === "lg" ? "size-5" : "size-3.5",
            value <= rating
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/40"
          )}
        />
      ))}
    </span>
  );
}

function filterByPeriod(rows: FeedbackWithOrder[], period: PeriodValue) {
  if (period === "all") return rows;
  const days = Number(period);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return rows.filter((row) => new Date(row.created_at).getTime() >= cutoff);
}

export function FeedbackPanel({
  feedback,
}: {
  feedback: FeedbackWithOrder[];
}) {
  const [period, setPeriod] = useState<PeriodValue>("30");
  const [ratingFilter, setRatingFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let rows = filterByPeriod(feedback, period);
    if (ratingFilter !== "all") {
      const rating = Number(ratingFilter);
      rows = rows.filter((row) => row.rating === rating);
    }
    return rows;
  }, [feedback, period, ratingFilter]);

  const avg = averageRating(filtered);

  const trendInsight = useMemo(() => {
    const rows = filtered.map((row) => ({
      rating: row.rating,
      sentiment:
        row.rating >= 4
          ? ("positive" as const)
          : row.rating <= 2
            ? ("negative" as const)
            : ("neutral" as const),
      category: null,
      createdAt: row.created_at,
      comment: row.comment,
    }));
    return analyzeFeedbackTrends(rows, period === "all" ? 90 : Number(period));
  }, [feedback, period, ratingFilter]);

  const trendLines = formatFeedbackDigestLines(trendInsight);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Guest feedback</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Post-delivery ratings and comments from guests.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">Average rating</p>
        <div className="mt-2 flex items-end gap-3">
          <p className="font-mono text-4xl font-bold text-foreground">
            {formatAverageRating(avg)}
          </p>
          {avg != null && <StarRating rating={Math.round(avg)} size="lg" />}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {filtered.length} ratings in selected period
        </p>
        {trendLines.length > 0 && (
          <ul className="mt-4 space-y-1 border-t border-border pt-4 text-sm text-muted-foreground">
            {trendLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodValue)}
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-card px-3 text-sm"
        >
          <option value="all">All ratings</option>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={String(value)}>
              {value} stars
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Date
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Order
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Rating
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Comment
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No ratings match the selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30/80">
                  <td className="whitespace-nowrap px-4 py-3 text-foreground/90">
                    {new Date(row.created_at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-foreground">
                    #{row.order_number}
                  </td>
                  <td className="px-4 py-3">
                    <StarRating rating={row.rating} />
                  </td>
                  <td className="max-w-md px-4 py-3 text-muted-foreground">
                    {row.comment?.trim() ? (
                      row.comment
                    ) : (
                      <span className="text-muted-foreground/70">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
