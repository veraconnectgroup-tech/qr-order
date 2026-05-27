"use client";

import { useTransition } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import {
  approveDenisLearnedEdge,
  rejectDenisLearnedEdge,
} from "@/lib/admin/denis-learned-actions";
import type { LearnedEdgeRow } from "@/lib/admin/denis-learned-edges";
import { Button } from "@/components/ui/button";

export function DenisLearnedEdgesManager({
  edges,
  productNames,
  learnedEnabled,
}: {
  edges: LearnedEdgeRow[];
  productNames: Record<string, string>;
  learnedEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function approve(edgeId: string) {
    startTransition(async () => {
      const result = await approveDenisLearnedEdge(edgeId);
      if (result.error) toast.error(result.error);
      else toast.success("Pairing approved — upsell rule created.");
    });
  }

  function reject(edgeId: string) {
    startTransition(async () => {
      const result = await rejectDenisLearnedEdge(edgeId);
      if (result.error) toast.error(result.error);
      else toast.success("Suggestion dismissed.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-5 text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold">Denis Insights</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Learned pairings from guest sessions — approve before they go live
            in upsell rules.
          </p>
          {!learnedEnabled ? (
            <p className="mt-2 text-sm text-amber-700">
              Queue is off — enable{" "}
              <code className="rounded bg-muted/50 px-1">
                learning.learnedEdgesEnabled
              </code>{" "}
              in Denis config to auto-collect candidates.
            </p>
          ) : null}
        </div>
      </div>

      {edges.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          No pending pairing suggestions. Denis needs more session data or cron
          aggregate runs.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">After</th>
                <th className="px-4 py-3">Suggest</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">Stats</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {edges.map((edge) => {
                const ratePct = Math.round(Number(edge.accept_rate) * 100);
                return (
                  <tr key={edge.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {productNames[edge.from_product_id] ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {productNames[edge.to_product_id] ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-blue-700">
                      {ratePct}%
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {edge.accepts}/{edge.impressions}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() => approve(edge.id)}
                        >
                          <Check className="size-4" />
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => reject(edge.id)}
                        >
                          <X className="size-4" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
