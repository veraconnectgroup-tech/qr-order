import { checkIpSessionBudget } from "@/lib/denis/security/abuse-tracker-store";

/** Reject session creation when an IP exceeds the hourly budget (100/h). */
export async function assertIpSessionBudget(
  clientIp: string | null | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!clientIp || clientIp === "unknown") {
    return { ok: true };
  }

  const allowed = await checkIpSessionBudget(clientIp);
  if (!allowed) {
    return {
      ok: false,
      error: "Too many table sessions from this network. Try again later.",
    };
  }

  return { ok: true };
}
