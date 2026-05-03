import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";

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
  const limitRaw = Number.parseInt(searchParams.get("limit") || "", 10);
  const limit = Number.isNaN(limitRaw)
    ? DEFAULT_LIMIT
    : Math.min(Math.max(limitRaw, 1), MAX_LIMIT);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      username: true,
      role: true,
      disabledAt: true,
      createdAt: true,
      _count: {
        select: {
          images: true,
          apiKeys: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, users });
}
