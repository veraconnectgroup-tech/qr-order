/** Guest waiter call — session optional (table resolved by QR token). */
export async function requestGuestWaiterCall(input: {
  tableToken: string;
  sessionToken?: string | null;
}): Promise<void> {
  const res = await fetch("/api/waiter-calls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tableToken: input.tableToken,
      ...(input.sessionToken ? { sessionToken: input.sessionToken } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error("waiter-call-failed");
  }
}
