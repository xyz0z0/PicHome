import { NextResponse } from "next/server";
import Busboy from "busboy";
import { Readable } from "stream";
import crypto from "crypto";
import path from "path";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

import { requireAuthFromRequest, requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorageAdapter } from "@/lib/storage";
import { rateLimitUpload } from "@/lib/rateLimit";
import { jsonError } from "@/lib/api";

const BYTES_PER_MB = 1024 * 1024;
const DEFAULT_MAX_FILE_SIZE_BYTES = 5 * BYTES_PER_MB;
const MIN_MAX_FILE_SIZE_BYTES = 1 * BYTES_PER_MB;
const FILE_TOO_LARGE_ERROR_CODE = "FILE_TOO_LARGE";
const FILE_FIELD_NAME = "file";
const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

function getMaxFileSizeBytes() {
  const rawValue = process.env.UPLOAD_MAX_BYTES;
  if (!rawValue) {
    return DEFAULT_MAX_FILE_SIZE_BYTES;
  }
  const parsedValue = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsedValue)) {
    return DEFAULT_MAX_FILE_SIZE_BYTES;
  }
  return Math.max(parsedValue, MIN_MAX_FILE_SIZE_BYTES);
}

function getMaxFileSizeMessage(maxFileSizeBytes: number) {
  const maxFileSizeMb = Math.floor(maxFileSizeBytes / BYTES_PER_MB);
  return `Image is too large. Max ${maxFileSizeMb}MB`;
}

function getBaseUrl() {
  return (process.env.BASEURL || "").replace(/\/+$/, "");
}

function toPosixPath(p: string) {
  return p.split(path.sep).join(path.posix.sep);
}

export async function POST(req: Request) {
  const auth = await requireAuthFromRequest(req);
  if ("error" in auth) {
    return jsonError(
      auth.error.status,
      auth.error.code,
      auth.error.message
    );
  }

  const user = auth.user;

  const rl = await rateLimitUpload(req);
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

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return jsonError(400, "INVALID_REQUEST", "Expected multipart/form-data");
  }

  const bodyStream = (req as any).body as ReadableStream | null;
  if (!bodyStream) {
    return jsonError(400, "INVALID_REQUEST", "Missing request body");
  }

  const headersObj = Object.fromEntries(req.headers.entries());

  const maxFileSizeBytes = getMaxFileSizeBytes();
  const bb = Busboy({
    headers: headersObj,
    limits: {
      files: 1,
      fileSize: maxFileSizeBytes,
    },
  });

  let buffer: Buffer | null = null;
  let originalName: string | null = null;
  let clientMime: string | null = null;

  try {
    await new Promise<void>((resolve, reject) => {
      let seen = false;

      bb.on(
        "file",
        (
          fieldname: string,
          file: NodeJS.ReadableStream,
          info: { filename: string; encoding: string; mimeType: string }
        ) => {
          if (seen) {
            // 只允许一个文件
            (file as any).resume();
            return;
          }
          if (fieldname !== FILE_FIELD_NAME) {
            (file as any).resume();
            return;
          }

          seen = true;
          // HTTP multipart 文件名以 Latin-1 传输，需还原为 UTF-8
          const rawName = info.filename || "upload";
          try {
            originalName = Buffer.from(rawName, "latin1").toString("utf8");
          } catch {
            originalName = rawName;
          }
          clientMime = info.mimeType || null;

          const chunks: Buffer[] = [];
          (file as any).on("data", (data: Buffer) =>
            chunks.push(Buffer.from(data))
          );
          (file as any).on("limit", () => {
            reject(new Error(FILE_TOO_LARGE_ERROR_CODE));
          });
          (file as any).on("error", (err: any) => reject(err));
          (file as any).on("end", () => {
            buffer = Buffer.concat(chunks);
          });
        }
      );

      bb.on("error", (err) => reject(err));
      bb.on("finish", () => resolve());

      Readable.fromWeb(bodyStream as any).pipe(bb);
    });
  } catch (error) {
    if (error instanceof Error && error.message === FILE_TOO_LARGE_ERROR_CODE) {
      return jsonError(
        413,
        "FILE_TOO_LARGE",
        getMaxFileSizeMessage(maxFileSizeBytes)
      );
    }
    throw error;
  }

  if (!buffer) {
    return jsonError(400, "INVALID_FILE", "Please upload a file");
  }

  const finalBuffer = buffer as unknown as Buffer;

  const detected = await fileTypeFromBuffer(finalBuffer);
  if (!detected?.mime || !ALLOWED_MIMES.has(detected.mime)) {
    return jsonError(400, "INVALID_FILE_TYPE", "Invalid file type");
  }

  // 统一转码为 webp（并生成缩略图）
  const imageId = crypto.randomUUID();

  const sha256 = crypto
    .createHash("sha256")
    .update(finalBuffer)
    .digest("hex");
  const meta = await sharp(finalBuffer).metadata();

  const originalWebp = await sharp(finalBuffer)
    .webp({ quality: 85 })
    .toBuffer();
  const thumbWebp = await sharp(finalBuffer)
    .resize({ width: 400, height: 400, fit: "inside" })
    .webp({ quality: 80 })
    .toBuffer();

  const storage = getStorageAdapter();

  const originalPath = toPosixPath(path.posix.join("images", imageId, "original.webp"));
  const thumbPath = toPosixPath(path.posix.join("images", imageId, "thumb.webp"));

  await storage.putObject({
    path: originalPath,
    data: originalWebp,
    contentType: "image/webp",
  });
  await storage.putObject({
    path: thumbPath,
    data: thumbWebp,
    contentType: "image/webp",
  });

  await prisma.image.create({
    data: {
      id: imageId,
      uploaderId: user.id,
      originalName: originalName || "upload",
      originalMimeType: detected.mime,
      size: finalBuffer.length,
      sha256,
      width: meta.width,
      height: meta.height,
      originalPath,
      thumbPath,
    },
  });

  const baseUrl = getBaseUrl();
  return NextResponse.json({
    ok: true,
    id: imageId,
    url: baseUrl
      ? `${baseUrl}/api/images/${imageId}?variant=original`
      : `/api/images/${imageId}?variant=original`,
    pageUrl: baseUrl ? `${baseUrl}/images/${imageId}` : `/images/${imageId}`,
    thumbUrl: baseUrl
      ? `${baseUrl}/api/images/${imageId}?variant=thumb`
      : `/api/images/${imageId}?variant=thumb`,
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const searchParams = url.searchParams;

  const mine = searchParams.get("mine");
  const cursor = searchParams.get("cursor");
  const limitRaw = searchParams.get("limit");

  const limit = Math.min(Math.max(parseInt(limitRaw || "20", 10), 1), 50);

  let where: any = { deletedAt: null, isVisible: true };
  const baseUrl = getBaseUrl();

  const wantsMine = mine === "true" || mine === "1";
  if (wantsMine) {
    const auth = await requireCurrentUser();
    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error.message },
        { status: auth.error.status }
      );
    }
    where = {
      deletedAt: null,
      uploaderId: auth.user.id,
    };
  }

  if (cursor) {
    const d = new Date(cursor);
    if (!Number.isNaN(d.getTime())) {
      where.createdAt = { lt: d };
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
    },
  });

  const items = images.map((img) => ({
    id: img.id,
    originalName: img.originalName,
    createdAt: img.createdAt,
    isVisible: img.isVisible,
    url: baseUrl
      ? `${baseUrl}/api/images/${img.id}?variant=original`
      : `/api/images/${img.id}?variant=original`,
    pageUrl: baseUrl ? `${baseUrl}/images/${img.id}` : `/images/${img.id}`,
    thumbUrl: baseUrl
      ? `${baseUrl}/api/images/${img.id}?variant=thumb`
      : `/api/images/${img.id}?variant=thumb`,
  }));

  const nextCursor =
    images.length === limit
      ? images[images.length - 1].createdAt.toISOString()
      : null;

  return NextResponse.json({ ok: true, items, nextCursor });
}

