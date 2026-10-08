import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export function createNotification(data: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}) {
  return prisma.notification.create({ data });
}

export interface NotificationListFilters {
  unreadOnly?: boolean;
  page: number;
  limit: number;
}

export async function findNotificationsForUser(userId: string, filters: NotificationListFilters) {
  const where: Prisma.NotificationWhereInput = { userId, ...(filters.unreadOnly ? { isRead: false } : {}) };
  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await prisma.$transaction([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: filters.limit }),
    prisma.notification.count({ where }),
  ]);
  return { items, total };
}

export function findNotificationById(id: string) {
  return prisma.notification.findUnique({ where: { id } });
}

// Indexed on [userId, isRead] - cheap even at scale, see schema.prisma.
export function countUnread(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export function markRead(id: string) {
  return prisma.notification.update({ where: { id }, data: { isRead: true, readAt: new Date() } });
}

export function markAllRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
}

export function deleteNotification(id: string) {
  return prisma.notification.delete({ where: { id } });
}
