import type { createAdminClient } from "@/lib/supabase/admin";
import { scheduleGuestSceneRefresh } from "./enqueue-scene-refresh";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Notify active guests that their table session moved (Prompt 88). */
export async function scheduleTableTransferGuestNotification(
  admin: AdminClient,
  input: {
    tableSessionId: string;
    toTableName: string;
    kind?: "transfer" | "split";
  }
): Promise<void> {
  const message =
    input.kind === "split"
      ? "Podelili smo vaš sto. Svako ima svoj račun."
      : `Prebačeni ste na sto ${input.toTableName}`;

  await scheduleGuestSceneRefresh(admin, {
    sessionId: input.tableSessionId,
    proactiveBanner: {
      id: `table-${input.kind ?? "transfer"}-${input.tableSessionId}`,
      message,
    },
  });
}
