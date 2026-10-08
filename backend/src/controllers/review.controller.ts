import { Request, Response } from "express";
import { ReviewStatus } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";
import * as reviewService from "../services/review.service";
import {
  AdminReviewListQuery,
  MyVendorReviewListQuery,
  VendorReviewListQuery,
} from "../validators/review.validator";

// --- Customer ---

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const review = await reviewService.createReview(req.user.id, req.params.bookingId, req.body);
  sendSuccess(res, { review }, 201);
});

export const listMyReviews = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await reviewService.listMyReviews(req.user.id, req.query as unknown as MyVendorReviewListQuery);
  sendSuccess(res, result);
});

export const updateReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const review = await reviewService.updateReview(req.user.id, req.params.id, req.body);
  sendSuccess(res, { review });
});

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await reviewService.deleteReview(req.user.id, req.params.id);
  res.status(204).send();
});

// --- Shared reads ---

export const getReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const review = await reviewService.getReview(req.user.id, req.user.role, req.params.id);
  sendSuccess(res, { review });
});

// --- Public ---

export const listVendorReviews = asyncHandler(async (req: Request, res: Response) => {
  const result = await reviewService.listVendorReviews(req.params.vendorId, req.query as unknown as VendorReviewListQuery);
  sendSuccess(res, result);
});

// --- Vendor: own reviews (all statuses) ---

export const listMyVendorReviews = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await reviewService.listMyVendorReviews(req.user.id, req.query as unknown as MyVendorReviewListQuery);
  sendSuccess(res, result);
});

// --- Admin ---

export const listReviewsForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const result = await reviewService.listReviewsForAdmin(req.query as unknown as AdminReviewListQuery);
  sendSuccess(res, result);
});

export const moderateReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { status } = req.body as { status: ReviewStatus };
  const review = await reviewService.moderateReview(req.user.id, req.params.id, status);
  sendSuccess(res, { review });
});
