import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AUDIT_ACTION } from "@/lib/audit";

const USER_DISABLE_OPERATION = {
  disable: "disable",
  enable: "enable",
} as const;

type UserDisableOperationValue =
  (typeof USER_DISABLE_OPERATION)[keyof typeof USER_DISABLE_OPERATION];

function isUserDisableOperation(
  value: string
): value is UserDisableOperationValue {
  return (
    value === USER_DISABLE_OPERATION.disable ||
    value === USER_DISABLE_OPERATION.enable
  );
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

  const targetUserId = Number.parseInt(params.id, 10);
  if (!Number.isInteger(targetUserId)) {
    return jsonError(400, "INVALID_USER_ID", "Invalid user id");
  }

  const body = await req.json().catch(() => null);
  const operation =
    typeof body?.operation === "string" ? body.operation.trim() : "";
  if (!isUserDisableOperation(operation)) {
    return jsonError(
      400,
      "INVALID_OPERATION",
      "operation must be disable or enable"
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      disabledAt: true,
    },
  });

  if (!targetUser) {
    return jsonError(404, "NOT_FOUND", "User not found");
  }

  const nextDisabledAt =
    operation === USER_DISABLE_OPERATION.disable ? new Date() : null;

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { disabledAt: nextDisabledAt },
    select: {
      id: true,
      username: true,
      role: true,
      disabledAt: true,
      createdAt: true,
    },
  });

  const action =
    operation === USER_DISABLE_OPERATION.disable
      ? AUDIT_ACTION.adminUserDisable
      : AUDIT_ACTION.adminUserEnable;

  await createAuditLog({
    actorId: auth.user.id,
    action,
    targetUserId,
  });

  return NextResponse.json({ ok: true, user: updatedUser });
}
