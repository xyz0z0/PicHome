import crypto from "crypto";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { UserRole } from "@/app/generated/prisma/enums";
import { prisma } from "./prisma";

export const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME?.trim() || "pichome_token";
const JWT_SECRET = process.env.JWT_SECRET;

export const AUTH_ERROR_CODE = {
  unauthorized: "UNAUTHORIZED",
  accountDisabled: "ACCOUNT_DISABLED",
  forbidden: "FORBIDDEN",
} as const;

const AUTH_ERROR_STATUS = {
  [AUTH_ERROR_CODE.unauthorized]: 401,
  [AUTH_ERROR_CODE.accountDisabled]: 403,
  [AUTH_ERROR_CODE.forbidden]: 403,
} as const;

type AuthErrorCode =
  (typeof AUTH_ERROR_CODE)[keyof typeof AUTH_ERROR_CODE];

export type AuthUser = {
  id: number;
  username: string;
  role: (typeof UserRole)[keyof typeof UserRole];
  disabledAt: Date | null;
};

export type AuthResult =
  | { user: AuthUser }
  | {
      error: {
        code: AuthErrorCode;
        message: string;
        status: number;
      };
    };

function createAuthError(
  code: AuthErrorCode,
  message: string
): AuthResult {
  return {
    error: {
      code,
      message,
      status: AUTH_ERROR_STATUS[code],
    },
  };
}

function getJwtSecretOrThrow() {
  if (!JWT_SECRET) {
    throw new Error(
      "Missing JWT_SECRET. Please set it in .env/.env.development/.env.production."
    );
  }
  return JWT_SECRET;
}

export function signToken(userId: number) {
  const secret = getJwtSecretOrThrow();
  return jwt.sign({ userId }, secret, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: number } {
  const secret = getJwtSecretOrThrow();
  const decoded = jwt.verify(token, secret) as { userId?: number };

  if (!decoded?.userId || typeof decoded.userId !== "number") {
    throw new Error("Invalid token payload");
  }

  return { userId: decoded.userId };
}

export async function getCurrentUser() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { userId } = verifyToken(token);
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        disabledAt: true,
      },
    });
  } catch {
    return null;
  }
}

export async function requireCurrentUser(): Promise<AuthResult> {
  const user = await getCurrentUser();
  if (!user) {
    return createAuthError(
      AUTH_ERROR_CODE.unauthorized,
      "Unauthorized"
    );
  }

  if (user.disabledAt) {
    return createAuthError(
      AUTH_ERROR_CODE.accountDisabled,
      "Account is disabled"
    );
  }

  return { user };
}

export async function requireAdminUser(): Promise<AuthResult> {
  const auth = await requireCurrentUser();
  if ("error" in auth) {
    return auth;
  }
  if (auth.user.role !== UserRole.ADMIN) {
    return createAuthError(AUTH_ERROR_CODE.forbidden, "Forbidden");
  }
  return auth;
}

export function getAuthCookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
  };
}

export function getAuthMaxAgeSeconds() {
  // 对齐 signToken 的 expiresIn（7d）
  return 7 * 24 * 60 * 60;
}

export function hashApiKey(rawKey: string) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/**
 * 优先检查 Authorization: Bearer <apikey>，
 * 不存在时回退到 Cookie JWT 认证。
 * 供需要同时支持浏览器和第三方工具的 API 路由使用。
 */
export async function requireAuthFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7).trim();
    const keyHash = hashApiKey(rawKey);
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            disabledAt: true,
          },
        },
      },
    });

    if (!apiKey || apiKey.revokedAt) {
      return createAuthError(
        AUTH_ERROR_CODE.unauthorized,
        "Invalid or revoked API key"
      );
    }

    if (apiKey.user.disabledAt) {
      return createAuthError(
        AUTH_ERROR_CODE.accountDisabled,
        "Account is disabled"
      );
    }

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return { user: apiKey.user };
  }

  return requireCurrentUser();
}

