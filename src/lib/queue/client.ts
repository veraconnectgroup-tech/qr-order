import { Client } from "@upstash/qstash";

const token = process.env.QSTASH_TOKEN;
// Regional QStash (e.g. US_EAST_1) requires the matching regional base URL —
// the token won't authenticate against the default global endpoint otherwise.
const baseUrl = process.env.QSTASH_URL;

export const qstash = token
  ? new Client(baseUrl ? { token, baseUrl } : { token })
  : null;

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function enqueue(
  path: string,
  body: Record<string, unknown>,
  options?: { delay?: number; retries?: number }
): Promise<void> {
  const url = `${appUrl()}${path}`;

  if (!token || !qstash) {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return;
  }

  await qstash.publishJSON({
    url,
    body,
    retries: options?.retries ?? 3,
    delay: options?.delay,
  });
}
