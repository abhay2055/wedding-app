import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

// Minimal, reusable audit trail for admin actions - see AdminAuditLog in
// schema.prisma. Intentionally small: a row per action, not a general
// event-sourcing/audit platform. There's no read API/UI for this yet
// (inspect via `prisma studio` for now) - only the write path exists,
// which is what "auditable" requires for Phase 3.
export function recordAdminAction(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  return prisma.adminAuditLog.create({
    data: {
      adminId,
      action,
      targetType,
      targetId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}
