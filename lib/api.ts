import { NextResponse } from "next/server";

export function jsonError(
  status: number,
  code: string,
  message: string
) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status }
  );
}

