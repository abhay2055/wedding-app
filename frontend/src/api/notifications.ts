import { apiClient } from "./client";
import { Notification, PaginatedResult } from "../types/api";

export interface NotificationListParams {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export async function listMyNotifications(params: NotificationListParams = {}): Promise<PaginatedResult<Notification>> {
  const res = await apiClient.get("/notifications", { params });
  return res.data.data;
}

export async function getUnreadCount(): Promise<number> {
  const res = await apiClient.get("/notifications/unread-count");
  return res.data.data.count;
}

export async function markRead(id: string): Promise<Notification> {
  const res = await apiClient.patch(`/notifications/${id}/read`);
  return res.data.data.notification;
}

export async function markAllRead(): Promise<void> {
  await apiClient.patch("/notifications/read-all");
}

export async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${id}`);
}
