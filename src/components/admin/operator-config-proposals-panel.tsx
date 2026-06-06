"use client";

import { toast } from "sonner";
import { reviewOperatorProposalAction } from "@/lib/admin/operator-proposal-actions";
import type { OperatorConfigProposal } from "@/lib/operator/config-proposals";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";

export function OperatorConfigProposalsPanel({
  proposals,
  canEdit,
}: {
  proposals: OperatorConfigProposal[];
  canEdit: boolean;
}) {
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

  return (
    <AdminPanel
      className="max-w-2xl"
      title="Operator config proposals"
      description="Viktor / operator AI suggestions — approve before applying to concierge config."
    >
      <ul className="mt-4 space-y-3">
        {proposals.map((proposal) => (
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
              </div>
              {canEdit && proposal.status === "pending" && (
                <div className="flex shrink-0 gap-2">
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
        ))}
        {proposals.length === 0 && (
          <p className="text-sm text-muted-foreground">No pending proposals.</p>
        )}
      </ul>
    </AdminPanel>
  );
}
