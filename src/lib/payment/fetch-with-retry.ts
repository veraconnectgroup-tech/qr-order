function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      /failed to fetch|network|load failed/i.test(error.message))
  );
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { maxAttempts?: number; baseDelayMs?: number }
): Promise<Response> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 500;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.status >= 500 && attempt < maxAttempts - 1) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      if (isRetryableNetworkError(error) && attempt < maxAttempts - 1) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Network error");
}

export function isServerErrorStatus(status: number) {
  return status >= 500;
}
