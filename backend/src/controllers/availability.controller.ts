import { Request, Response } from "express";
import { AvailabilityStatus } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";
import { parseDateOnly } from "../utils/dateOnly";
import * as availabilityService from "../services/availability.service";

function rangeFromQuery(req: Request) {
  const from = req.query.from ? parseDateOnly(req.query.from as string) ?? undefined : undefined;
  const to = req.query.to ? parseDateOnly(req.query.to as string) ?? undefined : undefined;
  return { from, to };
}

export const listMyAvailability = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { from, to } = rangeFromQuery(req);
  const availability = await availabilityService.listMyAvailability(req.user.id, from, to);
  sendSuccess(res, { availability });
});

export const setMyAvailability = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const availability = await availabilityService.setMyAvailability(req.user.id, req.body);
  sendSuccess(res, { availability }, 201);
});

export const bulkSetMyAvailability = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const availability = await availabilityService.bulkSetMyAvailability(req.user.id, req.body);
  sendSuccess(res, { availability, count: availability.length }, 201);
});

export const updateMyAvailability = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const availability = await availabilityService.updateMyAvailability(req.user.id, req.params.id, req.body);
  sendSuccess(res, { availability });
});

export const deleteMyAvailability = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await availabilityService.deleteMyAvailability(req.user.id, req.params.id);
  sendSuccess(res, { deleted: true });
});

export const getPublicVendorAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = rangeFromQuery(req);
  const availability = await availabilityService.getPublicAvailability(req.params.id, from, to);
  sendSuccess(res, { availability });
});

// --- Admin ---

export const getVendorAvailabilityForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = rangeFromQuery(req);
  const availability = await availabilityService.getVendorAvailabilityForAdmin(req.params.id, from, to);
  sendSuccess(res, { availability });
});

export const adminSetVendorAvailability = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const date = parseDateOnly(req.params.date);
  if (!date) throw ApiError.badRequest("Invalid date", "INVALID_DATE");
  const { status, note } = req.body as { status: AvailabilityStatus; note?: string };
  const availability = await availabilityService.adminSetVendorAvailability(
    req.user.id,
    req.params.id,
    date,
    status,
    note,
  );
  sendSuccess(res, { availability });
});
