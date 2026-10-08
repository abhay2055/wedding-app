import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";
import * as eventService from "../services/event.service";

export const listMyEvents = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const events = await eventService.listMyEvents(req.user.id);
  sendSuccess(res, { events });
});

export const getMyEvent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const event = await eventService.getMyEvent(req.user.id, req.params.id);
  sendSuccess(res, { event });
});

export const createEvent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const event = await eventService.createEvent(req.user.id, req.body);
  sendSuccess(res, { event }, 201);
});

export const updateEvent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const event = await eventService.updateEvent(req.user.id, req.params.id, req.body);
  sendSuccess(res, { event });
});

export const deleteEvent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await eventService.deleteEvent(req.user.id, req.params.id);
  sendSuccess(res, { deleted: true });
});
