"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { retryAdminDlqItemAction } from "@/lib/admin/dlq-actions";
import { Button } from "@/components/ui/button";

export function AdminDlqRetryButton({ dlqId }: { dlqId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await retryAdminDlqItemAction(dlqId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Event re-enqueued for processing.");
        });
      }}
    >
      {pending ? "Retrying…" : "Retry"}
    </Button>
  );
}
