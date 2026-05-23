import { NextResponse } from "next/server";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      data: null,
      error: message,
      ...(details !== undefined ? { details } : {}),
    },
    { status }
  );
}
