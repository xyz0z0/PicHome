import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser, hashApiKey } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export async function GET() {
  const auth = await requireCurrentUser();
  if ("error" in auth) {
    return jsonError(
      auth.error.status,
      auth.error.code,
      auth.error.message
    );
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: auth.user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return NextResponse.json({ ok: true, keys });
}

export async function POST(req: Request) {
  const auth = await requireCurrentUser();
  if ("error" in auth) {
    return jsonError(
      auth.error.status,
      auth.error.code,
      auth.error.message
    );
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return jsonError(400, "INVALID_NAME", "Key name is required");
  }

  const rawKey = `pk_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = hashApiKey(rawKey);
  const prefix = rawKey.slice(0, 10);

  const apiKey = await prisma.apiKey.create({
    data: {
      userId: auth.user.id,
      name,
      keyHash,
      prefix,
    },
    select: { id: true, name: true, prefix: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, key: { ...apiKey, rawKey } });
}
