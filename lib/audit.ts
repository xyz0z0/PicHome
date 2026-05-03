import { AuditAction } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const AUDIT_ACTION = {
  adminLogin: AuditAction.ADMIN_LOGIN,
  adminUserDisable: AuditAction.ADMIN_USER_DISABLE,
  adminUserEnable: AuditAction.ADMIN_USER_ENABLE,
  adminImageHide: AuditAction.ADMIN_IMAGE_HIDE,
  adminImageShow: AuditAction.ADMIN_IMAGE_SHOW,
  adminImageDelete: AuditAction.ADMIN_IMAGE_DELETE,
} as const;

type AuditActionValue =
  (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

type CreateAuditLogInput = {
  actorId: number;
  action: AuditActionValue;
  targetUserId?: number;
  detail?: string;
};

export async function createAuditLog(input: CreateAuditLogInput) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetUserId: input.targetUserId,
      detail: input.detail,
    },
  });
}
