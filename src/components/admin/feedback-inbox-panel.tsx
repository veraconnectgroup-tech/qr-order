"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markFeedbackHandledAction } from "@/lib/feedback/feedback-inbox-actions";
import type { FeedbackInboxItem } from "@/lib/feedback/feedback-inbox-store";

const SENTIMENT_LABEL: Record<FeedbackInboxItem["sentiment"], string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

export function FeedbackInboxPanel({
  items: initialItems,
}: {
  items: FeedbackInboxItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (items.length === 0) return null;

  function handle(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await markFeedbackHandledAction(id);
      if (result.error) {
        toast.error(result.error);
        setPendingId(null);
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      setPendingId(null);
    });
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-foreground">
          Needs response ({items.length})
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Negative or flagged feedback waiting for a staff follow-up.
      </p>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-start justify-between gap-3 rounded-md border border-border bg-card p-3 text-sm",
              pendingId === item.id && "opacity-60"
            )}
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                {SENTIMENT_LABEL[item.sentiment]}
                {item.category ? ` · ${item.category}` : ""}
                {item.rating != null ? ` · ${item.rating}/5` : ""}
              </p>
              {item.comment && (
                <p className="mt-1 text-muted-foreground">{item.comment}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground/70">
                {new Date(item.createdAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pendingId === item.id}
              onClick={() => handle(item.id)}
            >
              Mark handled
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
