import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(req: Request) {
  const auth = await requireAdminUser();
  if ("error" in auth) {
    return jsonError(
      auth.error.status,
      auth.error.code,
      auth.error.message
    );
  }

  const searchParams = new URL(req.url).searchParams;
  const cursor = searchParams.get("cursor");
  const limitRaw = Number.parseInt(searchParams.get("limit") || "", 10);
  const limit = Number.isNaN(limitRaw)
    ? DEFAULT_LIMIT
    : Math.min(Math.max(limitRaw, 1), MAX_LIMIT);

  const where: {
    createdAt?: { lt: Date };
  } = {};
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      where.createdAt = { lt: cursorDate };
    }
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      detail: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          username: true,
        },
      },
      targetUser: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  const nextCursor =
    logs.length === limit
      ? logs[logs.length - 1].createdAt.toISOString()
      : null;

  return NextResponse.json({ ok: true, logs, nextCursor });
}
