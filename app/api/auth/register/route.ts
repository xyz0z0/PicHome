import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimitRegister } from "@/lib/rateLimit";
import { jsonError } from "@/lib/api";
import { getRegistrationAvailability } from "@/lib/registrationMode";
import {
  isTurnstileSecretConfigured,
  verifyTurnstileToken,
} from "@/lib/turnstileVerify";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getAuthMaxAgeSeconds,
  signToken,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const registrationAvailability = await getRegistrationAvailability();
    if (!registrationAvailability.allowRegister) {
      return jsonError(
        403,
        "REGISTRATION_DISABLED",
        "当前为自用模式，已关闭公开注册"
      );
    }

    const rl = await rateLimitRegister(req);
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
    if (!body || typeof body !== "object") {
      return jsonError(400, "INVALID_BODY", "Invalid JSON body");
    }
    const username =
      typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const turnstileToken =
      typeof body?.turnstileToken === "string"
        ? body.turnstileToken.trim()
        : "";

    if (isTurnstileSecretConfigured()) {
      if (!turnstileToken) {
        return jsonError(
          400,
          "TURNSTILE_REQUIRED",
          "请先完成人机验证"
        );
      }
      const remoteIp = getClientIp(req);
      const turnstileResult = await verifyTurnstileToken(
        turnstileToken,
        remoteIp
      );
      if (!turnstileResult.ok) {
        return jsonError(
          400,
          "TURNSTILE_INVALID",
          "人机验证失败，请稍后重试"
        );
      }
    }

    if (!username || username.length < 3) {
      return jsonError(
        400,
        "INVALID_USERNAME",
        "Username must be at least 3 characters"
      );
    }
    if (!password || password.length < 6) {
      return jsonError(
        400,
        "INVALID_PASSWORD",
        "Password must be at least 6 characters"
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const user = await prisma.$transaction(async (tx) => {
        const userCount = await tx.user.count();
        const role = userCount === 0 ? UserRole.ADMIN : UserRole.USER;
        return tx.user.create({
          data: { username, passwordHash, role },
          select: { id: true, username: true, role: true },
        });
      });

      const token = signToken(user.id);
      const res = NextResponse.json({ ok: true, user });
      res.cookies.set(AUTH_COOKIE_NAME, token, {
        ...getAuthCookieOptions(),
        maxAge: getAuthMaxAgeSeconds(),
      });
      return res;
    } catch (e: any) {
      if (e?.code === "P2002") {
        return jsonError(
          409,
          "USERNAME_EXISTS",
          "Username already exists"
        );
      }
      throw e;
    }
  } catch (e: any) {
    // 保证返回 body，方便你排查 500 的真实原因
    console.error("register error:", e);
    const debugMessage = process.env.NODE_ENV === "development" ? e?.message : undefined;
    return jsonError(
      500,
      "INTERNAL_ERROR",
      debugMessage || "Internal server error"
    );
  }
}

