import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";
import * as notificationService from "../services/notification.service";
import { NotificationListQuery } from "../validators/notification.validator";

export const listMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await notificationService.listMyNotifications(req.user.id, req.query as unknown as NotificationListQuery);
  sendSuccess(res, result);
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const count = await notificationService.getUnreadCount(req.user.id);
  sendSuccess(res, { count });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const notification = await notificationService.markRead(req.user.id, req.params.id);
  sendSuccess(res, { notification });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await notificationService.markAllRead(req.user.id);
  sendSuccess(res, { success: true });
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await notificationService.deleteNotification(req.user.id, req.params.id);
  res.status(204).send();
});
