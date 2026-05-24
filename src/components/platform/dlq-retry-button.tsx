"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { retryDlqItemAction } from "@/lib/platform/platform-actions";
import { Button } from "@/components/ui/button";

export function DlqRetryButton({ dlqId }: { dlqId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await retryDlqItemAction(dlqId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Job re-enqueued.");
        });
      }}
    >
      {pending ? "Retrying…" : "Retry"}
    </Button>
  );
}
