"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import {
  averageRating,
  formatAverageRating,
  type FeedbackWithOrder,
} from "@/lib/feedback/feedback";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS = [
  { value: "7", label: "7 dana" },
  { value: "30", label: "30 dana" },
  { value: "90", label: "90 dana" },
  { value: "all", label: "Sve" },
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
              : "text-neutral-300"
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Ocene gostiju</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Povratne informacije posle isporuke narudžbe.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-neutral-500">Prosečna ocena</p>
        <div className="mt-2 flex items-end gap-3">
          <p className="font-mono text-4xl font-bold text-neutral-900">
            {formatAverageRating(avg)}
          </p>
          {avg != null && <StarRating rating={Math.round(avg)} size="lg" />}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {filtered.length} ocena u izabranom periodu
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodValue)}
          className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm"
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
          className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm"
        >
          <option value="all">Sve ocene</option>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={String(value)}>
              {value} zvezdica
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">
                Datum
              </th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">
                Narudžba
              </th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">
                Ocena
              </th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">
                Komentar
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-neutral-500"
                >
                  Nema ocena za izabrane filtere.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-neutral-50/80">
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-700">
                    {new Date(row.created_at).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-neutral-900">
                    #{row.order_number}
                  </td>
                  <td className="px-4 py-3">
                    <StarRating rating={row.rating} />
                  </td>
                  <td className="max-w-md px-4 py-3 text-neutral-600">
                    {row.comment?.trim() ? (
                      row.comment
                    ) : (
                      <span className="text-neutral-400">—</span>
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
