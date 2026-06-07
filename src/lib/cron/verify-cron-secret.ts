type CronAuthRequest = {
  headers: Headers;
  nextUrl?: { searchParams: URLSearchParams };
};

/** Accept Bearer, raw Authorization, x-cron-secret, or ?secret= (cron-job.org friendly). */
export function verifyCronSecret(
  req: CronAuthRequest,
  secret: string | undefined
): boolean {
  const expected = secret?.trim();
  if (!expected) return false;

  const authorization = req.headers.get("authorization")?.trim() ?? "";
  if (authorization === `Bearer ${expected}` || authorization === expected) {
    return true;
  }

  const headerSecret = req.headers.get("x-cron-secret")?.trim();
  if (headerSecret === expected) return true;

  const querySecret = req.nextUrl?.searchParams.get("secret")?.trim();
  if (querySecret === expected) return true;

  return false;
}
