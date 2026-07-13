"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  approveAdapterVersionAction,
  rejectAdapterVersionAction,
} from "@/lib/platform/integration-review-actions";

export function AdapterReviewActions({
  approvalRequestId,
}: {
  approvalRequestId: string;
}) {
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Review notes (required to reject, optional to approve)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={pending}
        rows={3}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await approveAdapterVersionAction(
                approvalRequestId,
                notes
              );
              if (result.error) {
                toast.error(String(result.error));
                return;
              }
              toast.success("Adapter version approved.");
              router.push("/platform/integrations");
            });
          }}
        >
          {pending ? "Working…" : "Approve"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await rejectAdapterVersionAction(
                approvalRequestId,
                notes
              );
              if (result.error) {
                toast.error(String(result.error));
                return;
              }
              toast.success("Adapter version rejected.");
              router.push("/platform/integrations");
            });
          }}
        >
          {pending ? "Working…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}
