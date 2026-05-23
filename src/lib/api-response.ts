import { NextResponse } from "next/server";

export function apiSuccess<T>(
  data: T,
  status = 200,
  headers?: Record<string, string>
) {
  return NextResponse.json({ data, error: null }, { status, headers });
}

export function apiError(
  message: string,
  status = 400,
  details?: unknown,
  headers?: Record<string, string>
) {
  return NextResponse.json(
    {
      data: null,
      error: message,
      ...(details !== undefined ? { details } : {}),
    },
    { status, headers }
  );
}
