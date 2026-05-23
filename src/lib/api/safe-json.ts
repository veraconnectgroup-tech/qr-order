import type { NextRequest } from "next/server";

export async function safeJsonParse<T = unknown>(
  req: NextRequest
): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
