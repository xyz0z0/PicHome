import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole } from "@/app/generated/prisma/enums";
import { createAuditLog, AUDIT_ACTION } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { rateLimitLogin } from "@/lib/rateLimit";
import { jsonError } from "@/lib/api";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getAuthMaxAgeSeconds,
  signToken,
} from "@/lib/auth";

export async function POST(req: Request) {
  const rl = await rateLimitLogin(req);
  if (rl.limited) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "RATE_LIMITED", message: "Too many requests" },
        retryAfterMs: rl.retryAfterMs,
      },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return jsonError(400, "INVALID_CREDENTIALS", "Invalid credentials");
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      role: true,
      disabledAt: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return jsonError(400, "INVALID_CREDENTIALS", "Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return jsonError(400, "INVALID_CREDENTIALS", "Invalid credentials");
  }

  if (user.disabledAt) {
    return jsonError(403, "ACCOUNT_DISABLED", "Account is disabled");
  }

  if (user.role === UserRole.ADMIN) {
    await createAuditLog({
      actorId: user.id,
      action: AUDIT_ACTION.adminLogin,
    });
  }

  const token = signToken(user.id);
  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    ...getAuthCookieOptions(),
    maxAge: getAuthMaxAgeSeconds(),
  });
  return res;
}

