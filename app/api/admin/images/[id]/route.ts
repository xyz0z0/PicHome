import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AUDIT_ACTION } from "@/lib/audit";

const VISIBILITY_OPERATION = {
  hide: "hide",
  show: "show",
} as const;

type VisibilityOperationValue =
  (typeof VISIBILITY_OPERATION)[keyof typeof VISIBILITY_OPERATION];

function isVisibilityOperation(value: string): value is VisibilityOperationValue {
  return (
    value === VISIBILITY_OPERATION.hide || value === VISIBILITY_OPERATION.show
  );
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminUser();
  if ("error" in auth) {
    return jsonError(
      auth.error.status,
      auth.error.code,
      auth.error.message
    );
  }

  const image = await prisma.image.findUnique({
    where: { id: params.id },
    select: { id: true, deletedAt: true },
  });

  if (!image || image.deletedAt) {
    return jsonError(404, "NOT_FOUND", "Image not found");
  }

  await prisma.image.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    actorId: auth.user.id,
    action: AUDIT_ACTION.adminImageDelete,
    detail: `imageId=${image.id}`,
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminUser();
  if ("error" in auth) {
    return jsonError(
      auth.error.status,
      auth.error.code,
      auth.error.message
    );
  }

  const body = await req.json().catch(() => null);
  const operation =
    typeof body?.operation === "string" ? body.operation.trim() : "";
  if (!isVisibilityOperation(operation)) {
    return jsonError(
      400,
      "INVALID_OPERATION",
      "operation must be hide or show"
    );
  }

  const image = await prisma.image.findUnique({
    where: { id: params.id },
    select: { id: true, isVisible: true, deletedAt: true },
  });

  if (!image || image.deletedAt) {
    return jsonError(404, "NOT_FOUND", "Image not found");
  }

  const nextVisible = operation === VISIBILITY_OPERATION.show;
  const updatedImage = await prisma.image.update({
    where: { id: params.id },
    data: { isVisible: nextVisible },
    select: {
      id: true,
      isVisible: true,
    },
  });

  const action =
    nextVisible ? AUDIT_ACTION.adminImageShow : AUDIT_ACTION.adminImageHide;
  await createAuditLog({
    actorId: auth.user.id,
    action,
    detail: `imageId=${updatedImage.id}`,
  });

  return NextResponse.json({ ok: true, image: updatedImage });
}
