/** Safely parse JSON from a fetch Response; avoids Safari's cryptic parse errors. */
export async function readJsonResponse<T = unknown>(
  res: Response
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const text = await res.text();
  if (!text) {
    return {
      ok: false,
      error: res.ok
        ? "Empty server response."
        : `Server error (${res.status}). Try again.`,
    };
  }

  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return {
      ok: false,
      error: res.ok
        ? "Unexpected server response."
        : `Server error (${res.status}). Try again.`,
    };
  }
}
