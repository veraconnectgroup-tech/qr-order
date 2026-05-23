import { Client } from "@upstash/qstash";

const token = process.env.QSTASH_TOKEN;

export const qstash = token ? new Client({ token }) : null;

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
