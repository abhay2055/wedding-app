import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";
import * as bookingService from "../services/booking.service";
import { BookingListQuery, AdminBookingListQuery } from "../validators/booking.validator";

// --- Customer ---

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const booking = await bookingService.createBooking(req.user.id, req.body);
  sendSuccess(res, { booking }, 201);
});

export const listMyBookings = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await bookingService.listMyBookingsAsCustomer(req.user.id, req.query as unknown as BookingListQuery);
  sendSuccess(res, result);
});

export const getMyBooking = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const booking = await bookingService.getMyBookingAsCustomer(req.user.id, req.params.id);
  sendSuccess(res, { booking });
});

export const cancelMyBooking = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const booking = await bookingService.cancelBooking(req.user.id, req.user.role, req.params.id, req.body.reason);
  sendSuccess(res, { booking });
});

// --- Vendor ---

export const listVendorBookings = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await bookingService.listMyBookingsAsVendor(req.user.id, req.query as unknown as BookingListQuery);
  sendSuccess(res, result);
});

export const getVendorBooking = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const booking = await bookingService.getMyBookingAsVendor(req.user.id, req.params.id);
  sendSuccess(res, { booking });
});

export const acceptVendorBooking = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const booking = await bookingService.acceptBooking(req.user.id, req.params.id, req.body.vendorNotes);
  sendSuccess(res, { booking });
});

export const declineVendorBooking = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const booking = await bookingService.declineBooking(req.user.id, req.params.id, req.body.vendorNotes);
  sendSuccess(res, { booking });
});

export const cancelVendorBooking = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const booking = await bookingService.cancelBooking(req.user.id, req.user.role, req.params.id, req.body.reason);
  sendSuccess(res, { booking });
});

export const completeVendorBooking = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const booking = await bookingService.completeBooking(req.user.id, req.params.id);
  sendSuccess(res, { booking });
});

// --- Admin (read-only) ---

export const listBookingsForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const result = await bookingService.listBookingsForAdmin(req.query as unknown as AdminBookingListQuery);
  sendSuccess(res, result);
});
