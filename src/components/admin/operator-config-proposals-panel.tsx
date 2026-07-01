"use client";

import { useTransition } from "react";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { reviewOperatorProposalAction, shadowTestOperatorProposalAction } from "@/lib/admin/operator-proposal-actions";
import type { OperatorProposalPreview } from "@/lib/admin/build-operator-proposal-previews";
import type { OperatorConfigProposal } from "@/lib/operator/config-proposals";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";

export function OperatorConfigProposalsPanel({
  proposals,
  previews,
  canEdit,
}: {
  proposals: OperatorConfigProposal[];
  previews: OperatorProposalPreview[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const previewById = new Map(previews.map((row) => [row.proposalId, row.diffLines]));

  async function handleReview(
    proposalId: string,
    decision: "approved" | "rejected"
  ) {
    const result = await reviewOperatorProposalAction(proposalId, decision);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(decision === "approved" ? "Proposal approved" : "Proposal rejected");
  }

  function handleShadowTest(proposalId: string) {
    startTransition(async () => {
      const result = await shadowTestOperatorProposalAction(proposalId);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Shadow test enabled for 30 minutes.");
    });
  }

  return (
    <AdminPanel
      className="max-w-2xl"
      title="Operator config proposals"
      description="Viktor / operator AI suggestions — review diff before approving."
    >
      <ul className="mt-4 space-y-3">
        {proposals.map((proposal) => {
          const diffLines = previewById.get(proposal.id) ?? [];

          return (
            <li
              key={proposal.id}
              className="rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {proposal.kind} · {proposal.status}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {proposal.reason}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Location {proposal.locationId.slice(0, 8)}… ·{" "}
                    {new Date(proposal.createdAt).toLocaleString()}
                  </p>
                  {diffLines.length > 0 && (
                    <div className="mt-3 rounded-md border border-border/80 bg-background/60 p-2 font-mono text-[11px] whitespace-pre-wrap text-muted-foreground">
                      {diffLines.join("\n")}
                    </div>
                  )}
                </div>
                {canEdit && proposal.status === "pending" && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {proposal.kind === "config" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => handleShadowTest(proposal.id)}
                      >
                        <FlaskConical className="mr-1 size-3.5" />
                        Shadow test
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleReview(proposal.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleReview(proposal.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {proposals.length === 0 && (
          <p className="text-sm text-muted-foreground">No pending proposals.</p>
        )}
      </ul>
    </AdminPanel>
  );
}
