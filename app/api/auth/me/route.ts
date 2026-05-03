import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireCurrentUser();
  if ("error" in auth) {
    return NextResponse.json(
      { message: auth.error.message, code: auth.error.code },
      { status: auth.error.status }
    );
  }
  return NextResponse.json({ user: auth.user });
}

