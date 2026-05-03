import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorageAdapter } from "@/lib/storage";
import { getCurrentUser, requireAuthFromRequest } from "@/lib/auth";

const VARIANT_ORIGINAL = "original";
const VARIANT_THUMB = "thumb";
const PLACEHOLDER_WIDTH_BY_VARIANT: Record<string, number> = {
  [VARIANT_THUMB]: 400,
  [VARIANT_ORIGINAL]: 1280,
};
const PLACEHOLDER_HEIGHT_BY_VARIANT: Record<string, number> = {
  [VARIANT_THUMB]: 300,
  [VARIANT_ORIGINAL]: 720,
};
const PLACEHOLDER_BACKGROUND = "#f3f4f6";
const PLACEHOLDER_TEXT = "#6b7280";
const PLACEHOLDER_LABEL = "图片暂不可见";

function getVariant(searchValue: string | null): string {
  if (searchValue === VARIANT_THUMB) {
    return VARIANT_THUMB;
  }
  return VARIANT_ORIGINAL;
}

function createInvisiblePlaceholderSvg(variant: string): string {
  const width = PLACEHOLDER_WIDTH_BY_VARIANT[variant] || PLACEHOLDER_WIDTH_BY_VARIANT[VARIANT_ORIGINAL];
  const height =
    PLACEHOLDER_HEIGHT_BY_VARIANT[variant] || PLACEHOLDER_HEIGHT_BY_VARIANT[VARIANT_ORIGINAL];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${PLACEHOLDER_BACKGROUND}" />
  <g fill="${PLACEHOLDER_TEXT}" text-anchor="middle" font-family="Arial, sans-serif">
    <text x="50%" y="46%" font-size="28">${PLACEHOLDER_LABEL}</text>
    <text x="50%" y="56%" font-size="16">This image is hidden by uploader</text>
  </g>
</svg>`;
}

function invisiblePlaceholderResponse(variant: string): NextResponse {
  const placeholderSvg = createInvisiblePlaceholderSvg(variant);
  return new NextResponse(placeholderSvg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const url = new URL(req.url);
  const variant = getVariant(url.searchParams.get("variant"));

  const image = await prisma.image.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      uploaderId: true,
      deletedAt: true,
      isVisible: true,
      originalPath: true,
      thumbPath: true,
    },
  });

  if (!image) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  // 软删除后：未登录不允许访问；上传者可访问。
  if (image.deletedAt) {
    const user = await getCurrentUser();
    if (!user || user.id !== image.uploaderId) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
  }

  if (!image.isVisible) {
    return invisiblePlaceholderResponse(variant);
  }

  const storage = getStorageAdapter();
  const relPath = variant === VARIANT_THUMB ? image.thumbPath : image.originalPath;

  try {
    const data = await storage.getObject(relPath);

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "content-type": "image/webp",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuthFromRequest(req);
  if ("error" in auth) {
    return NextResponse.json(
      { message: auth.error.message },
      { status: auth.error.status }
    );
  }

  const user = auth.user;

  const image = await prisma.image.findUnique({
    where: { id: params.id },
    select: { id: true, uploaderId: true, deletedAt: true },
  });

  if (!image || image.deletedAt) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (image.uploaderId !== user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await prisma.image.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  // 软删除：本阶段不物理删除文件，便于后续扩展回收站/恢复。
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuthFromRequest(req);
  if ("error" in auth) {
    return NextResponse.json(
      { message: auth.error.message },
      { status: auth.error.status }
    );
  }

  const body = await req.json().catch(() => null);
  const visible = body?.visible;
  if (typeof visible !== "boolean") {
    return NextResponse.json(
      { message: "Bad Request: visible must be boolean" },
      { status: 400 }
    );
  }

  const image = await prisma.image.findUnique({
    where: { id: params.id },
    select: { id: true, uploaderId: true, deletedAt: true },
  });

  if (!image || image.deletedAt) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (image.uploaderId !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const updatedImage = await prisma.image.update({
    where: { id: params.id },
    data: { isVisible: visible },
    select: { id: true, isVisible: true },
  });

  return NextResponse.json({ ok: true, image: updatedImage });
}

