import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireCurrentUser();
  if ("error" in auth) {
    return jsonError(
      auth.error.status,
      auth.error.code,
      auth.error.message
    );
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, revokedAt: true },
  });

  if (!apiKey || apiKey.revokedAt) {
    return jsonError(404, "NOT_FOUND", "API key not found");
  }

  if (apiKey.userId !== auth.user.id) {
    return jsonError(403, "FORBIDDEN", "Forbidden");
  }

  await prisma.apiKey.update({
    where: { id: params.id },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
