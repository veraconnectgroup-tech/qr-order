type PendingApprovalContext = {
  capabilities: { awaitingApproval: boolean };
  pendingApprovalOrderId: string | null;
} | null;

/** Local approval state or table context when staff confirmation is pending. */
export function resolveActiveApprovalOrderId(
  approvalOrderId: string | null,
  context: PendingApprovalContext
): string | null {
  if (approvalOrderId) return approvalOrderId;
  if (
    context?.capabilities.awaitingApproval &&
    context.pendingApprovalOrderId
  ) {
    return context.pendingApprovalOrderId;
  }
  return null;
}
