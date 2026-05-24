import { apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { isPushConfigured } from "@/lib/push/vapid";

/** Public VAPID key at runtime — avoids rebuild when env vars are added on Vercel. */
export const GET = withErrorHandler("push-config-get", async () => {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";

  return apiSuccess({
    configured: isPushConfigured(),
    publicKey: publicKey || null,
  });
});
