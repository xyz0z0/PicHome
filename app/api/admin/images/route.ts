import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function getBaseUrl() {
  return (process.env.BASEURL || "").replace(/\/+$/, "");
}

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
    deletedAt: null;
    createdAt?: { lt: Date };
  } = { deletedAt: null };

  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      where.createdAt = { lt: cursorDate };
    }
  }

  const images = await prisma.image.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      originalName: true,
      createdAt: true,
      isVisible: true,
      uploader: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  const baseUrl = getBaseUrl();
  const items = images.map((image) => ({
    id: image.id,
    originalName: image.originalName,
    createdAt: image.createdAt,
    isVisible: image.isVisible,
    uploader: image.uploader,
    url: baseUrl
      ? `${baseUrl}/api/images/${image.id}?variant=original`
      : `/api/images/${image.id}?variant=original`,
    pageUrl: baseUrl ? `${baseUrl}/images/${image.id}` : `/images/${image.id}`,
    thumbUrl: baseUrl
      ? `${baseUrl}/api/images/${image.id}?variant=thumb`
      : `/api/images/${image.id}?variant=thumb`,
  }));

  const nextCursor =
    images.length === limit
      ? images[images.length - 1].createdAt.toISOString()
      : null;

  return NextResponse.json({ ok: true, items, nextCursor });
}
